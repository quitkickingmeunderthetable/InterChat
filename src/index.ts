import db from './utils/Db.js';
import Scheduler from './services/SchedulerService.js';
import { startApi } from './api/index.js';
import { isDevBuild } from './utils/Constants.js';
import { VoteManager } from './managers/VoteManager.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import syncBotlistStats from './scripts/tasks/syncBotlistStats.js';
import deleteExpiredInvites from './scripts/tasks/deleteExpiredInvites.js';
import updateBlacklists from './scripts/tasks/updateBlacklists.js';
import deleteOldMessages from './scripts/tasks/deleteOldMessages.js';
import 'dotenv/config';
import { getUsername, wait } from './utils/Utils.js';
import Logger from './utils/Logger.js';

const clusterManager = new ClusterManager('build/InterChat.js', {
  token: process.env.TOKEN,
  shardsPerClusters: 2,
});

clusterManager.on('clusterCreate', async (cluster) => {
  // if it is the last cluster
  if (cluster.id === clusterManager.totalClusters - 1) {
    const scheduler = new Scheduler();
    // remove expired blacklists or set new timers for them
    const serverQuery = { where: { hubs: { some: { expires: { isSet: true } } } } };
    const userQuery = { where: { blacklistedFrom: { some: { expires: { isSet: true } } } } };
    updateBlacklists(await db.blacklistedServers.findMany(serverQuery), scheduler)
      .catch(Logger.error);

    updateBlacklists(await db.userData.findMany(userQuery), scheduler)
      .catch(Logger.error);

    // code must be in production to run these tasks
    if (isDevBuild) return;
    // give time for shards to connect for these tasks
    await wait(10_000);

    // perform start up tasks
    syncBotlistStats(clusterManager).catch(Logger.error);
    deleteOldMessages().catch(Logger.error);
    deleteExpiredInvites().catch(Logger.error);

    scheduler.addRecurringTask('deleteExpiredInvites', 60 * 60 * 1_000, deleteExpiredInvites);
    scheduler.addRecurringTask('deleteOldMessages', 60 * 60 * 12_000, deleteOldMessages);
    scheduler.addRecurringTask('syncBotlistStats', 60 * 10_000, () =>
      syncBotlistStats(clusterManager),
    );
  }
});

const voteManager = new VoteManager(clusterManager);
voteManager.on('vote', async (vote) => {
  const username = (await getUsername(clusterManager, vote.user)) ?? undefined;
  await voteManager.incrementUserVote(vote.user, username);
  await voteManager.addVoterRole(vote.user);
  await voteManager.announceVote(vote);
});

// spawn clusters and start the api that handles nsfw filter and votes
clusterManager.spawn({ timeout: -1 })
  .then(() => startApi({ voteManager }))
  .catch(Logger.error);

