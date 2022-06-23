/* eslint-disable no-inline-comments */
const { MessageEmbed } = require('discord.js');
const logger = require('../logger');
const { getDb, colors, developers, clean } = require('../utils');
const { client } = require('../index');
const { messageTypes } = require('../scripts/message/messageTypes');
const wordFilter = require('../scripts/message/wordFilter');
const Filter = require('bad-words'),
	filter = new Filter();

module.exports = {
	name: 'messageCreate',
	async execute(message) {
		if (message.author.bot) return;

		// The actual eval command
		if (message.content.startsWith('c!eval')) {
			message.content = message.content.replace(/```js|```/g, '');

			// Get our input arguments
			const args = message.content.split(' ').slice(1);

			// If the message author's ID does not equal
			// our ownerID, get outta there!
			// eslint-disable-next-line no-undef
			if (!developers.includes(BigInt(message.author.id))) {return console.log('Someone used eval');}

			// In case something fails, we to catch errors
			// in a try/catch block
			try {
				// Evaluate (execute) our input
				const evaled = eval(args.join(' '));

				// Put our eval result through the function
				// we defined above
				const cleaned = await clean(client, evaled);


				// create a new embed
				const embed = new MessageEmbed()
					.setColor('BLURPLE')
					.setTitle('Evaluation')
					.setFields([
						{ name: 'Input', value: `\`\`\`js\n${args.join(' ')}\n\`\`\`` },
						{ name: 'Output', value: `\`\`\`js\n${cleaned}\n\`\`\`` },
					])
					.setTimestamp();

				// if cleaned includes [REDACTED] then send a colored codeblock
				if (cleaned.includes('[REDACTED]')) embed.spliceFields(1, 1, { name: 'Output', value:  `\`\`\`ansi\n${cleaned}\n\`\`\` ` });


				if (embed.length > 6000) return message.reply('Output too long to send. Logged to console. Check log file for more info.');

				// Reply in the channel with our result
				message.channel.send({ embeds: [embed] });
			}
			catch (err) {
				// Reply in the channel with our error
				message.channel.send(`\`ERROR\` \`\`\`xl\n${err}\n\`\`\``);
			}

			// End of our command
		}

		if (message.content.startsWith('c!help') || message.content.startsWith('c!connect') || message.content.startsWith('c!disconnect')) {
			await message.reply('ChatBot does not respond to any commands with the prefix `c!` anymore since we have switched to slash commands! Please type / and check out the list of commands!');
			return;
		}

		// main db where ALL connected channel data is stored
		const database = getDb();
		const connectedList = database.collection('connectedList');

		// db for setup data
		const setup = database.collection('setup');
		const channelInNetwork = await connectedList.findOne({ channelId: message.channel.id });

		// db for blacklisted users
		const blacklistedUsers = database.collection('blacklistedUsers');
		const userInBlacklist = await blacklistedUsers.findOne({ userId: message.author.id });

		// db for blacklisted words
		const restrictedWords = database.collection('restrictedWords');
		const wordList = await restrictedWords.findOne({ name: 'blacklistedWords' });

		// Checks if channel is in databse, rename maybe?
		if (channelInNetwork) {
			const database = getDb()
			const collection = database.collection('message')
			const messageid = message.id;
			const userid = message.author.id;

			collection.insertOne({
				user: {
					name: message.author.tag,
					id: message.author.id 
				},
				message: {
					id: message.id,
					content: message.content
				},
				channel: {
					name: message.channel.name,
					id: message.id
				},
				guild: {
					name: message.guild.name,
					id: message.guild.id,
				},
				timestamp: message.createdTimestamp
			}).then(() => {
				setInterval(() => {
					collection.deleteOne({'message.id': messageid });
				}, 3000);
			});

			let usermessages = await collection.find({'user.id':userid}).toArray();
			if(usermessages.length>1){
				await message.client.users.cache.get(userid).send('stop spamming or you will face divine judgement or something');
				return message.delete();
			}

			if (userInBlacklist) {
				// if user is in blacklist an notified is false, send them a message saying they are blacklisted
				if (!userInBlacklist.notified) {
					message.author.send(`You are blacklisted from using this bot for reason **${userInBlacklist.reason}**. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
					blacklistedUsers.updateOne({ userId: message.author.id }, { $set: { notified: true } });
				}
				return;
			}

			// check if message contains slurs
			if (message.content.toLowerCase().includes(wordList.words[0]) || message.content.toLowerCase().includes(wordList.words[1]) || message.content.toLowerCase().includes(wordList.words[2])) {
				wordFilter.log(message);
				return message.author.send('That word has been blacklisted by the developers.');
			}

			// check if message contains profanity
			if (filter.isProfane(message.content)) message.content = await wordFilter.execute(message);


			const allConnectedChannels = await connectedList.find();

			const embed = new MessageEmbed()
				.setTimestamp()
				.setColor(colors())
				.setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL({ dynamic: true }), url: `https://discord.com/users/${message.author.id}` })
				.setFooter({ text: `From: ${message.guild}┃${message.guild.id}`, iconURL: message.guild.iconURL({ dynamic: true }) })
				.addFields([
					{ name: 'Message', value: message.content || '\u200B', inline: false }]);

			await require('../scripts/message/addBadges').execute(message, database, embed);
			await require('../scripts/message/messageContentModifiers').execute(message, embed);

			// delete the message only if it doesn't contain images
			if (message.attachments.first() === undefined) {
				try {await message.delete();}
				catch (err) {logger.warn(err + ' cannot delete message');}
			}
			const deletedChannels = [];

			// NOTE: Using the db used here in other chatbot's will end up deleting all servers when you send a message... so be careful XD
			allConnectedChannels.forEach(async channelObj => {
				try {
					// trying to fetch all channels to see if they exist
					await client.channels.fetch(channelObj.channelId);
				}
				catch (e) {
					// if channels doesn't exist push to deletedChannels array
					logger.error(e);
					deletedChannels.push(channelObj.channelId);
					await connectedList.deleteMany({
						channelId: {
							$in: deletedChannels,
						},
					});
					// deleting the channels that was pushed to deletedChannels earlier, from the databse
					await setup.deleteMany({
						'channel.id': {
							$in: deletedChannels, // NOTE: $in only takes array
						},
					});

					// replace this with something that doesnt iterate twise idk lmao
					// REVIEW: This suddenly started to work, make sure it really does and isnt luck! Bug testing or something

					return;
				}
				await messageTypes(client, message, channelObj, embed, setup);

			});
		}
		else {
			return;
		}
	},
};
