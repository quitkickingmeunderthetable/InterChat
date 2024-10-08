import db from '../Db.js';
import { Prisma, hubs } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  EmbedBuilder,
  roleMention,
  GuildTextBasedChannel,
  messageLink,
  User,
  Client,
} from 'discord.js';
import { emojis } from '../../config/Constants.js';
import { fetchHub, resolveEval } from '../Utils.js';
import { sendLog } from './Default.js';

export type ReportEvidenceOpts = {
  // the message content
  content?: string;
  messageId?: string;
  attachmentUrl?: string;
};

export type LogReportOpts = {
  userId: string;
  serverId: string;
  reason: string;
  reportedBy: User;
  evidence?: ReportEvidenceOpts;
};

/**
 * Retrieves the jump link for a specific message in the reports channel of a hub.
 * @param hubId - The ID of the hub.
 * @param messageId - The ID of the message. (optional)
 * @param reportsChannelId - The ID of the reports channel.
 * @returns The jump link for the specified message, or undefined if the message is not found.
 */
const genJumpLink = async (
  hubId: string,
  client: Client,
  messageId: string | undefined,
  reportsChannelId: string,
) => {
  if (!messageId) return null;

  const messageInDb = await db.broadcastedMessages.findFirst({
    where: { messageId },
    include: { originalMsg: { include: { broadcastMsgs: true } } },
  });
  if (!messageInDb) return null;

  // fetch the reports server ID from the log channel's ID
  const reportsServerId = resolveEval(
    await client.cluster.broadcastEval(
      async (cl, channelId) => {
        const channel = (await cl.channels
          .fetch(channelId)
          .catch(() => null)) as GuildTextBasedChannel | null;
        return channel?.guild.id;
      },
      { context: reportsChannelId },
    ),
  );

  const networkChannel = await db.connectedList.findFirst({
    where: { serverId: reportsServerId, hubId },
  });
  const reportsServerMsg = messageInDb.originalMsg.broadcastMsgs.find(
    (msg) => msg.channelId === networkChannel?.channelId,
  );

  if (!networkChannel || !reportsServerMsg) return null;
  return messageLink(networkChannel.channelId, reportsServerMsg.messageId, networkChannel.serverId);
};

/**
 * Logs a report with the specified details.
 * @param userId - The ID of the user being reported.
 * @param serverId - The ID of the server being reported.
 * @param reason - The reason for the report.
 * @param reportedBy - The user who reported the incident.
 * @param evidence - Optional evidence for the report.
 */
export const sendHubReport = async (
  hubId: string,
  client: Client,
  { userId, serverId, reason, reportedBy, evidence }: LogReportOpts,
) => {
  const hub = await fetchHub(hubId);
  if (!hub?.logChannels?.reports?.channelId) return;

  const { channelId: reportsChannelId, roleId: reportsRoleId } = hub.logChannels.reports;
  const server = await client.fetchGuild(serverId);
  const jumpLink = await genJumpLink(hubId, client, evidence?.messageId, reportsChannelId);

  // TODO: make it mandatory for hubs to set a report channel and support server
  const embed = new EmbedBuilder()
    .setTitle('New Report')
    .setColor('Red')
    .setImage(evidence?.attachmentUrl ?? null)
    .setDescription(
      stripIndents`
        ${emojis.dotRed} **Reported User:** <@${userId}> (${userId})
        ${emojis.dotRed} **Reported Server:** ${server?.name} (${serverId})

        ${emojis.info} **Message Content:**
        \`\`\`${evidence?.content?.replaceAll('`', '\\`')}\`\`\`
      `,
    )
    .addFields([
      { name: 'Reason', value: reason, inline: true },
      { name: 'Jump To Reported Message', value: jumpLink ?? 'N/A', inline: true },
    ])
    .setFooter({
      text: `Reported by: ${reportedBy.username}`,
      iconURL: reportedBy.displayAvatarURL(),
    });

  const mentionRole = reportsRoleId ? roleMention(reportsRoleId) : undefined;
  await sendLog(client, reportsChannelId, embed, mentionRole);
};

const updateLogChannels = async (
  hubId: string,
  logChannels: Prisma.HubLogChannelsCreateInput | Prisma.HubLogChannelsNullableUpdateEnvelopeInput,
) => {
  await db.hubs.update({ where: { id: hubId }, data: { logChannels } });
};

export const removeReportsFrom = async (hubId: string) => {
  await updateLogChannels(hubId, { upsert: { set: null, update: { reports: null } } });
};

export const setReportLogChannel = async (hubId: string, channelId: string) => {
  const data = { channelId };

  await updateLogChannels(hubId, {
    upsert: {
      set: { reports: data },
      update: { reports: { upsert: { set: data, update: data } } },
    },
  });
};

export const setReportRole = async (hub: hubs, roleId: string) => {
  if (!hub?.logChannels?.reports) {
    throw new Error('Role ID can only be set if Channel ID is also set.');
  }

  await updateLogChannels(hub.id, {
    ...hub.logChannels,
    reports: { ...hub.logChannels.reports, roleId },
  });
};

export const setReportChannelAndRole = async (hubId: string, channelId: string, roleId: string) => {
  const data = { reports: { channelId, roleId } };
  await updateLogChannels(hubId, { upsert: { set: data, update: data } });
};

export default {
  sendHubReport,
  setReportLogChannel,
  setReportRole,
  setReportChannelAndRole,
  removeReportsFrom,
};
