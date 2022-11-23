import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { stripIndents } from 'common-tags';
import { toHuman, getDb, colors } from '../../Utils/functions/utils';
import os from 'os';

export default {
	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Shows the bot\'s statistics'),
	async execute(interaction: ChatInputCommandInteraction) {
		const uptime = toHuman(interaction.client?.uptime as number);
		const osUptime = toHuman(os.uptime() * 1000);

		const connectedList = getDb().connectedList;
		const allConnected = await connectedList?.findMany({});
		const count = await connectedList?.count();

		const docsLink = 'https://discord-chatbot.gitbook.io/docs';
		const inviteLink = 'https://discord.com/api/oauth2/authorize?client_id=769921109209907241&permissions=154820537425&scope=bot%20applications.commands';
		const supportServer = 'https://discord.gg/6bhXQynAPs';

		let connectedMembers = 0;
		for (const guildEntry of allConnected) {
			let guild;
			try {
				guild = await interaction.client.guilds.fetch(String(guildEntry.serverId));
			}
			catch {
				continue;
			}
			connectedMembers += guild.memberCount;
		}

		const embed = new EmbedBuilder()
			.setAuthor({ name: `${interaction.client.user?.username} Statistics`, iconURL: interaction.client.user?.avatarURL() as string })
			.setColor(colors('chatbot'))
			.setDescription(`[Invite](${inviteLink}) • [Support](${supportServer}) • [Docs](${docsLink})`)
			.addFields([
				{
					name: 'System',
					value: stripIndents`\`\`\`elm
					CPU: ${os.cpus()[0].model}
					Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB / ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
					Uptime: ${osUptime}
					Discord.JS: ${require('discord.js/package.json').version}
					Node.JS: ${process.version}
					\`\`\``,
				},
				{
					name: 'Bot',
					value: stripIndents`\`\`\`elm
					Ping: ${interaction.client.ws.ping}ms
					Uptime: ${uptime}
					Servers: ${interaction.client.guilds.cache.size}
					Users: ${interaction.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}
					Commands: ${interaction.client.commands.size}
					Bot Version: v${interaction.client.version}
					\`\`\``,
					inline: true,
				},
				{
					name: 'Chat Network',
					value: stripIndents`\`\`\`elm
					Servers: ${count}
					Members: ${connectedMembers}
					\`\`\``,
					inline: true,
				},
			]);
		await interaction.reply({ embeds: [embed] });
	},

};