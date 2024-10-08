import Constants, { emojis } from '#main/utils/Constants.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { channelMention } from '#main/utils/Utils.js';
import { Prisma, hubs } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { EmbedBuilder } from 'discord.js';

/*
for later:
${emojis.arrow} \`msgEdit:\`
${emojis.divider} Log message when it is edited.
${emojis.dividerEnd} ${channelStr} ${undefined ?? emojis.no}
${emojis.arrow} \`msgDelete:\`
${emojis.divider} Log message when it is deleted.
${emojis.dividerEnd} ${channelStr} ${undefined ?? emojis.no}
*/

export const genLogInfoEmbed = (hubInDb: hubs, locale: supportedLocaleCodes = 'en') => {
  const { reports, modLogs, profanity, joinLeaves } = (hubInDb.logChannels ||
    {}) as Prisma.HubLogChannelsCreateInput;
  const reportRole = reports?.roleId ? `<@&${reports.roleId}>` : emojis.no;
  const channelStr = t({ phrase: 'hub.manage.logs.config.fields.channel', locale });
  const roleStr = t({ phrase: 'hub.manage.logs.config.fields.role', locale });

  return new EmbedBuilder()
    .setTitle(t({ phrase: 'hub.manage.logs.title', locale }))
    .setDescription(
      stripIndents`
        ${emojis.arrow} \`reports:\`
        ${emojis.divider} ${t({ phrase: 'hub.manage.logs.reports.description', locale })}
        ${emojis.divider} ${channelStr} ${channelMention(reports?.channelId)}
        ${emojis.dividerEnd} ${roleStr}: ${reportRole}
        ${emojis.arrow} \`modLogs:\`
        ${emojis.divider} ${t({ phrase: 'hub.manage.logs.modLogs.description', locale })}
        ${emojis.dividerEnd} ${channelStr} ${channelMention(modLogs)}
        ${emojis.arrow} \`profanity:\`
        ${emojis.divider} ${t({ phrase: 'hub.manage.logs.profanity.description', locale })}
        ${emojis.dividerEnd} ${channelStr} ${channelMention(profanity)}
        ${emojis.arrow} \`joinLeave:\`
        ${emojis.divider} ${t({ phrase: 'hub.manage.logs.joinLeave.description', locale })}
        ${emojis.dividerEnd} ${channelStr} ${channelMention(joinLeaves)}`,
    )
    .setColor(Constants.Colors.invisible)
    .setThumbnail(hubInDb.iconUrl)
    .setFooter({
      text: 'Note: This feature is still experimental. Report bugs using /support report.',
    });
};
