require('dotenv').config();
const Discord = require('discord.js');
const mongoose = require('mongoose');

const client = new Discord.Client();
mongoose.connect(process.env.MONGO_URL, {useUnifiedTopology: true, useNewUrlParser: true, useFindAndModify: false});
const User = mongoose.model('User', { uid: String, points: { type: Number, default: 0 } });
const Channel = mongoose.model('Channel', { cid: String, latest: { type: String, default: "<>" } });
const Submission = mongoose.model('Submission', { uid: String, data: String });
const Image = mongoose.model('Image', {solution: String, url: String});

function errorHandler(err) {
    console.error(err);
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setPresence({
        game: {
            name: "elf!help"
        }
    })
});

client.on('guildCreate', guild => {
    guild.createChannel("elf-on-the-shelf", {
        topic: "Elf on the Shelf games!",
        type: "text"
    }).then(channel => {
        new Channel({cid: channel.id}).save().then(() => {
            channel.send("Welcome to the Elf on the Shelf game!\n\nEvery 10 minutes, a new image will be posted. You will have to guess what is on the image, and it has to rhyme!\n\nIf you guess correctly, you get a point. Points can't be used currently, in the future we might introduce a shop.\n\nGLHF!").catch(errorHandler);
        }).catch(errorHandler);
    }).catch(errorHandler);
})

client.on('message', message => {
    var safeContent = message.content.trim();
    if (safeContent.startsWith("elf!")) {
        var command = safeContent.slice(4);
        
        if (command.startsWith("help")) {
            message.react("🙌").then(() => {
                message.author.send("**Elf on the Shelf**\nWelcome to Elf on the Shelf! In any Discord server that has this bot, there will be a channel for this bot. In that channel, every 10 minutes, a new image will be posted, and you will have to guess what's on it in a rhyming way.\n\nIf your guess is correct, you get a point. You can't use points for anything yet, but you'll be able to use them in the future.\n\n**Commands**\n`elf!help` - DMs you this text.\n`elf!stats` - Shows how much points you have.\n`elf!submit <solution> <link to image>` - Submits an image.").catch(errorHandler);
            }).catch(errorHandler);
            return;
        }

        if (command.startsWith("stats")) {
            User.findOne({uid: message.author.id}).then(elfUser => {
                var points = 0;
                if (elfUser) points = elfUser.points;

                message.reply(`You have ${points} points.`).catch(errorHandler);
            }).catch(errorHandler);
            return;
        }

        if (command.startsWith("submit")) {
            new Submission({
                uid: message.author.id,
                data: command
            }).save().then(() => {
                message.reply("Your submission has been sent. Thank you!").catch(errorHandler);
            }).catch(errorHandler);
            return;
        }

        if (command.startsWith("insert") && message.author.id == "265888902219431946") {
            var args = command.split(" ").slice(1).join(" ").split(",");

            new Image({
                solution: args[0],
                url: args[1]
            }).save().then(() => {
                message.reply("added chief").catch(errorHandler);
            }).catch(errorHandler);
            return;
        }
    }

    Channel.findOne({ cid: message.channel.id }).then(elfChannel => {
        if (!elfChannel) return;
        if (elfChannel.latest == "<>") return;

        if (elfChannel.latest == message.content.trim().toLowerCase()) {
            Channel.findOneAndUpdate({cid: elfChannel.cid}, {$set: {latest: "<>"}}).then(() => {
                User.findOneAndUpdate({uid: message.author.id}, {$inc: { points: 1 }}, {upsert: true}).then(() => {
                    message.channel.send(`<@${message.author.id}> has got the correct answer! A point has been awarded to them.`).catch(errorHandler);
                }).catch(errorHandler)
            }).catch(errorHandler);
        }
    }).catch(errorHandler);
});

client.login(process.env.DISCORD_TOKEN);

setInterval(function timer() {
    Channel.find().then(elfChannels => {
        var channels = elfChannels.map(x => client.channels.get(x.cid)).filter(x => x != null);
        console.log(channels.length)

        Image.find().then(images => {
            channels.forEach(channel => {
                if (!channel instanceof Discord.TextChannel) return console.warn("Channel not TextChannel?");

                var image = images[Math.floor(Math.random()*images.length)];
                
                channel.send("You've heard of Elf on the Shelf, now get ready for " + image.url).catch(errorHandler).then(() => {
                    Channel.findOneAndUpdate({cid: channel.id}, {$set: { latest: image.solution }}).catch(errorHandler);
                });
            });
        }).catch(errorHandler)
    });
}, 60 * 1000);