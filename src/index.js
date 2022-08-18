'use strict';
const discord = require('discord.js');
const mongoUtil = require('./utils/functions/utils');
const Levels = require('discord-xp');
const logger = require('./utils/logger');
const packagejson = require('../package.json');
const { loadCommands } = require('./handlers/handleCommands.js');
const { loadEvents } = require('./handlers/handleEvents.js');

Levels.setURL(process.env.MONGODB_URI); // FIXME: Change this to your MongoDB Atlas URL
require('dotenv').config();

mongoUtil.connect((err, mongoClient) => {
	if (err) logger.error(err);
	logger.info('Connected to MongoDB');
});

const client = new discord.Client({
	intents: [
		discord.GatewayIntentBits.Guilds,
		discord.GatewayIntentBits.GuildMessages,
		discord.GatewayIntentBits.GuildMembers,
		discord.GatewayIntentBits.MessageContent,
	],
	presence: {
		status: 'online',
		activities: [{
			name: 'the Chat Network',
			type: discord.ActivityType.Watching,
		}],
	},
});

client.commands = new discord.Collection();
client.description = packagejson.description;
client.version = packagejson.version;
client.help = [];

loadCommands(client);
loadEvents(client);

process.on('uncaughtException', (err) => {
	logger.error('[Anti-Crash - Exception]:', err);
});
process.on('unhandledRejection', (err) => {
	logger.error('[Anti Crash - Rejection]:', err);
});


const app = require('express')();
const port = process.env.PORT || 8080;

app.listen(port, () => logger.info(`Express app listening on port ${port}`));
app.get('/', (req, res) => res.status(200).send('Acknowledged'));

client.login(process.env.TOKEN);