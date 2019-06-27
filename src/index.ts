import { Client, Message, User, Collection, Channel, Snowflake, RichEmbed } from 'discord.js';
require('dotenv').config();
import { inspect } from 'util';

// 1-file bot :poggers:

const client: Client = new Client();
const prefix: string = (process.env.PREFIX || '007');

const activeGames: string[] = [];

const constructEmbed = (title: string, ammo: number[]): RichEmbed => new RichEmbed()
    .setTitle(title)
    .addField('Your ammo:', ammo[0], true)
    .addField('Their ammo:', ammo[1], true)
    .setFooter('Type shoot, block, reload, or surrender. You have 30 seconds to make your decision.');

client.on('message', async (msg: Message): Promise<Message | Message[] | undefined> => {
    // Usage: 007start @6463#6463
    if (msg.content === '007help')
        return msg.reply(`Want to start a game? Say \`007start @User#1234\` to challenge someone to a duel!
**Rules:**
\`\`\`asciidoc
- You must have at least 1 ammo to shoot.
- Shooting consumes 1 ammo.
- Reloading gives the player 1 ammo.
- If you shoot but the other player blocks, the other player survives.
- If you shoot and the other player reloads, you win the game.
- If both players shoot, nothing happens. 
- You cannot shield more than five times in a row.
- Each player has 30 seconds to make their decision.
\`\`\`
`);

    if (!msg.content.startsWith(`${prefix}start `)) return;

    try {
        var authorChan = await msg.author.createDM();
        await authorChan.send('Sending game request...');
    } catch (err) {
        return msg.reply('Please make sure that your DMs are open before trying to start a game.');
    }

    if (activeGames.includes(msg.author.id)) return msg.reply('You are already in a game!');

    const user: User = msg.mentions.users.first();

    if (!user) return msg.reply('Invalid user provided.');

    if (user.bot) return msg.reply('Bots can\'t hold guns (yet).');

    if (user.id === msg.author.id) return msg.reply('Are you really that lonely?');

    const name1: string = msg.author.tag;
    const name2: string = user.tag;

    try {
        var userChan = await user.createDM();
        await userChan.send(`${name1} has challenged you to a Double-O-Seven duel! Reply to this message with \`yes\` within 30 seconds to accept, or with \`no\` to decline the duel.`);
    } catch (err) {
        return msg.reply(`${name2}'s DMs are not open. Both players must have DMs open to start a game.`);
    }

    if (activeGames.includes(user.id)) return msg.reply(`${name2} is already in a game.`);

    if (activeGames.includes(msg.author.id)) return msg.reply('You are already in a game!');

    try {
        const collected: Collection<Snowflake, Message> = await userChan.awaitMessages((m: Message): boolean => m.content.toLowerCase() === 'yes' || m.content.toLowerCase() === 'no', {
            max: 1,
            time: 120000,
            errors: ['time'] // eslint-disable-line
        });
        var response: Message = collected.first();
    } catch (err) {
        return msg.reply(`${name2} failed to reply within 120 seconds. Looks like someone was too scared to fight :(`);
    }

    console.log(`Starting game between ${name1} and ${name2}!`);

    if (response.content === 'yes') {
        const gameID: number = Date.now() + Math.floor(Math.random() * 1000);
        const ammo: number[] = [0, 0]; // eslint-disable-line
        const shields: number[] = [0, 0]; // eslint-disable-line

        let actions1: Message = <Message>await msg.author.send(constructEmbed('Double-O-Seven Duel! Opponent: ' + name2, ammo));
        let actions2: Message = <Message>await user.send(constructEmbed('Double-O-Seven Duel! Opponent: ' + name1, ammo));

        activeGames.push(msg.author.id);
        activeGames.push(user.id);

        const gameOptions = {
            max: 1,
            time: 30000,
            errors: ['time'] // eslint-disable-line
        };

        while (1) {
            try {
                var actions: Collection<string, Message>[] = await Promise.all([
                    authorChan.awaitMessages((m: Message): boolean => {
                        const command: string = m.content.toLowerCase();
                        if (command === 'shoot' && ammo[0] <= 0) return !msg.reply('Not enough ammo. Pick another option.');
                        if (command === 'block' && shields[0] >= 5) return !msg.reply('You can only block 5 times in a row. Pick another option.');
                        return ['shoot', 'reload', 'block', 'surrender'].includes(command); // eslint-disable-line
                    }, gameOptions),
                    userChan.awaitMessages((m: Message): boolean => {
                        const command: string = m.content.toLowerCase();
                        if (command === 'shoot' && ammo[1] <= 0) return !msg.reply('Not enough ammo. Pick another option.');
                        if (command === 'block' && shields[1] >= 5) return !msg.reply('You can only block 5 times in a row. Pick another option.');
                        return ['shoot', 'reload', 'block', 'surrender'].includes(command); // eslint-disable-line
                    }, gameOptions),
                ]);
            } catch (err) {
                await msg.reply('A player failed to act in the given timeframe. The game will be aborted.');
                break;
            }

            let message: string = '';

            const [a1, a2]: string[] = actions.map(a => (a.first() || { content: 'surrender' }).content.toLowerCase()); // eslint-disable-line

            if (a1 === 'block') {
                shields[0]++;
            } else {
                shields[0] = 0;
            }

            if (a2 === 'block') {
                shields[1]++;
            } else {
                shields[1] = 0;
            }

            if (a1 === a2) {
                if (a1 === 'reload') {                  // Both reload
                    ammo[0]++;
                    ammo[1]++;
                    message = 'Both players reload. Nothing eventful happens.';
                } else if (a1 === 'shoot') {            // Both shoot
                    ammo[0]--;
                    ammo[1]--;
                    message = `${name1} and ${name2} both fire at the same time. The bullets collide in mid-air, and disintigrate into fine gunpowder, leaving both duelers unharmed.`;
                } else if (a1 === 'block') {            // Both block
                    message = 'Both players block, defending themselves from absolutely nothing.';
                } else {                                // Both surrender
                    message = `${name1} and ${name2} both raise their hands in surrender. The game ends without any casualties.`;
                    user.send(message);
                    msg.author.send(message);
                    break;
                }
            } else if (a1 === 'surrender') {            // Player 1 surrenders
                message = `${name1} drops their gun. The game ends without any casualties. ${name2} is the winner!`;
                user.send(message);
                msg.author.send(message);
                break;
            } else if (a2 === 'surrender') {            // Player 2 surrenders
                message = `${name2} brings out the white flag. The game ends without any casualties. ${name1} is the winner!`;
                user.send(message);
                msg.author.send(message);
                break;
            } else if (a1 === 'shoot') {                // First player shoots
                ammo[0]--;
                if (a2 === 'block') {                   // But second player blocks
                    message = `${name1} takes a shot - but ${name2} blocks it!`;
                } else {                                // Or second player reloads - game over
                    message = `${name2} tries to reload, but ${name1} shoots him before he can finish! ${name1} is the winner!`;
                    user.send(message);
                    msg.author.send(message);
                    break;
                }
            } else if (a2 === 'shoot') {                // Second play shoots
                ammo[1]--;
                if (a1 === 'block') {                   // But first player blocks
                    message = `${name2} takes a shot - but ${name1} blocks it!`;
                } else {                                // Or first player reloads - game over
                    message = `${name1} tries to reload, but ${name2} shoots him before he can finish! ${name2} is the winner!`;
                    user.send(message);
                    msg.author.send(message);
                    break;
                }
            } else if (a2 === 'block' && a1 === 'reload') { // Kind of self-explanatory
                message = `${name2} blocks ${name1}'s aggressive reloading! Nothing happens, though.`;
                ammo[0]++;
            } else if (a1 === 'block' && a2 === 'reload') {
                message = `${name1} blocks ${name2}'s aggressive reloading! Nothing happens, though.`;
                ammo[1]++;
            } else {
                message = 'This shouldn\'t be happening.';
            }

            await user.send(message);
            await msg.author.send(message);

            actions1 = <Message>await msg.author.send(constructEmbed('Double-O-Seven Duel! Opponent: ' + name2, ammo));
            actions2 = <Message>await user.send(constructEmbed('Double-O-Seven Duel! Opponent: ' + name1, ammo.slice().reverse()));
        }

        activeGames.splice(activeGames.indexOf(msg.author.id), 1);
        activeGames.splice(activeGames.indexOf(user.id, 1));

    } else {
        return msg.reply(`${name2} declined your duel. 🐔 🐔 🐔`);
    }

    return;
});

client.on('ready', (): void => {
    console.log('Bot started.');
    client.user.setActivity('007help');
});

process.on('unhandledRejection', (err) => console.log(err));

client.login(process.env.TOKEN);