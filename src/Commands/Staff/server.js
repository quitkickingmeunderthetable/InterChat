const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const utils = require('../../utils/functions/utils');
module.exports = {
	staff: true,
	data: new SlashCommandBuilder()
		.setName('server')
		.setDescription('Leaves the specified server. Staff-only.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('leave')
				.setDescription('Leaves the specified server. Staff-only.')
				.addStringOption((stringOption) =>
					stringOption
						.setName('server')
						.setDescription('The server to leave.')
						.setRequired(true),
				)
				.addStringOption((stringOption) =>
					stringOption
						.setName('reason')
						.setDescription('The reason for leaving the server.')
						.setRequired(true),
				)
				.addBooleanOption(boolOption =>
					boolOption
						.setName('notify')
						.setDescription('Whether to notify the server about the leave.')
						.setRequired(false),
				),
		)

		.addSubcommand((subcommand) =>
			subcommand
				.setName('disconnect')
				.setDescription('Disconnects from the specified server. Staff-only.')
				.addStringOption((stringOption) =>
					stringOption
						.setName('serverid')
						.setDescription('The server you want to disconnect from the network.')
						.setRequired(true),
				),
		),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const database = utils.getDb();

		await require(`../../Scripts/server/${subcommand}`).execute(interaction, database);
	},
};