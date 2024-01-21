import db from './utils/Db.js';
import Logger from './utils/Logger.js';
import SuperClient from './SuperClient.js';
import CommandManager from './managers/CommandManager.js';
import { NetworkMessage } from './managers/NetworkManager.js';
import { check } from './utils/Profanity.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { stripIndents } from 'common-tags';
import { LINKS, channels, colors, emojis } from './utils/Constants.js';
import { initI18n } from './utils/Locale.js';
import { logGuildJoin, logGuildLeave } from './scripts/guilds/goals.js';
import getWelcomeTargets from './scripts/guilds/getWelcomeTarget.js';

class InterChat extends SuperClient {
  public constructor() {
    super();

    this.once('ready', () => {
      // initialize the client
      this.init();

      // initialize i18n for localization
      initI18n();

      // load commands
      CommandManager.loadCommandFiles();

      Logger.info(`Logged in as ${this.user?.tag}!`);
    });

    this.on('shardReady', (s, u) => {
      if (u) {
        Logger.warn(`Shard ${s} is ready but ${u.size} guilds are unavailable.`);
      }
      else {
        Logger.info(`Shard ${s} is ready!`);
      }
    });

    this.on('guildCreate', async (guild) => {
      Logger.info(`Joined ${guild.name} (${guild.id})`);

      // log that bot joined a guild to goal channel in support server
      logGuildJoin(guild, channels.goal);

      const { guildOwner, guildChannel } = await getWelcomeTargets(guild);

      const checkProfanity = check(guild.name);
      if (checkProfanity.profanity || checkProfanity.slurs) {
        const profaneErrorEmbed = new EmbedBuilder()
          .setTitle('Leave Notice 👋')
          .setDescription(
            `${emojis.no} Your server name contains profanity or sensitive content. Please change it before using InterChat.`,
          )
          .setColor(colors.invisible)
          .setFooter({ text: `Sent for: ${guild.name}`, iconURL: guild.iconURL() || undefined });

        const message = { embeds: [profaneErrorEmbed] };

        (guildOwner || guildChannel)
          ?.send(message)
          .catch(() => guildChannel?.send(message).catch(() => null));
        await guild.leave();
      }

      // notify the person who added the bot
      const embed = new EmbedBuilder()
        .setTitle('👋 Thanks for adding me to your server!')
        .setDescription(
          stripIndents`              
              Take your first step into the world of cross-server chatting with InterChat! 🚀 Explore public hubs, connect with multiple servers, and add a splash of excitement to your server experience. ${emojis.clipart}
              ### Getting Started
              - Simply run </help:924659340898619398> to see an easy to follow setup guide.
              - Or visit our in-depth [web guide](${LINKS.DOCS}/setup) for more information.

              If you need help, join our [support server](${LINKS.SUPPORT_INVITE}) and we'll be happy to help you out!
          `,
        )
        .setColor(colors.interchatBlue)
        .setFooter({ text: `Sent for: ${guild.name}`, iconURL: guild.iconURL() || undefined });

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Docs')
          .setURL(`${LINKS.DOCS}/setup`)
          .setEmoji(emojis.guide_icon)
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setLabel('Terms')
          .setURL(`${LINKS.DOCS}/legal/terms`)
          .setEmoji(emojis.docs_icon)
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setLabel('Privacy')
          .setURL(`${LINKS.DOCS}/legal/privacy`)
          .setEmoji(emojis.lock_icon)
          .setStyle(ButtonStyle.Link),
      );

      const message = { embeds: [embed], components: [buttons] };
      await (guildOwner || guildChannel)
        ?.send(message)
        .catch(() => guildChannel?.send(message).catch(() => null));
    });

    // delete guild from database
    this.on('guildDelete', async (guild) => {
      if (!guild.available) return;

      Logger.info(`Left ${guild.name} (${guild.id})`);

      // find all connections that belong to this guild
      const connections = await db.connectedList.findMany({ where: { serverId: guild.id } });
      // delete them from the database
      await db.connectedList.deleteMany({ where: { serverId: guild.id } });

      // send server leave log to hubs
      connections.forEach((connection) =>
        this.joinLeaveLogger.logServerLeave(connection.hubId, guild),
      );

      await logGuildLeave(guild, channels.goal);
    });

    // handle slash/ctx commands
    this.on('interactionCreate', (interaction) =>
      this.getCommandManager().handleInteraction(interaction),
    );

    // handle network reactions
    this.on('messageReactionAdd', (react, usr) => this.getReactionUpdater().listen(react, usr));

    // handle messages
    this.on('messageCreate', async (message) => {
      if (message.author.bot || message.system || message.webhookId) return;
      this.getNetworkManager().handleNetworkMessage(message as NetworkMessage);
    });

    this.on('debug', (debug) => {
      Logger.debug(debug);
    });
    this.rest.on('restDebug', (debug) => Logger.debug(debug));
    this.rest.on('rateLimited', (rl) => Logger.warn('Rate limited: %O', rl));
  }
}

const client = new InterChat();

client.login(process.env.TOKEN);
