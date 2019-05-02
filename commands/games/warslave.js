const command = require("discord.js-commando");
var IndexRef = require("../../index.js")
var slaves = [{key: "Key", users: [{id: "", owner: "", price: 0}]}];
var firebase = require("firebase");
var signedIntoFirebase = false;
var listening = false;
var patrons = [{userID: "", type: 0}];

firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        signedIntoFirebase = true;

        if(!listening)
        {
            firebase.database().ref("patrons").on("child_added", function(snapshot){
                patrons.push({userID: snapshot.key, type: snapshot.val()})
            })
            
            firebase.database().ref("patrons").on("child_removed", function(snapshot){
                for(var i = 0; i < patrons.length; i++)
                {
                    if(patrons[i] == snapshot.key)
                    {
                        patrons[i].userID = ""
                    }
                }
            })

            firebase.database().ref("patrons").on("child_changed", function(snapshot){
                for(var i = 0; i < patrons.length; i++)
                {
                    if(patrons[i] == snapshot.key)
                    {
                        patrons[i].type = snapshot.val()
                    }
                }
            })

            listening = true;
        }
    } 
    else
    {
        signedIntoFirebase = false;
    }
  });
const numberWithCommas = (x) => {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

class WarSlaveCommand extends command.Command
 {
    constructor(client)
    {
        super(client, {
            name: "warslave",
            group: "games",
            memberName: "warslave",
            description: "Play the War Slave Game where you purchase other users on your server as slaves. Buy other users as slaves, gift them war tokens to increase their value so that no one else can buy them. Sell your slaves to earn back your tokens. These tokens can also be earned by voting for Slav Bot on discordbots.org or by participating in token giveaways on the support server. You can also earn tokens by buying roles on the support server or becoming a patreon supporter and get tokens monthly.",
            examples: ["`!warslave profile [@User (optional)]` (Check how many tokens/slaves you or another user have and other info)", "`!warslave collect` (Gather Slave Trading Resources)", "`!warslave buy @User` (Buy a slave)", "`!warslave sell @User` (Sell a slave)", "`!warslave gift <amount> @User1 @User2` (Gift tokens to your slaves to increase their value)", "`!warslave give <amount> @User1 @User2` (Give your tokens to another user)"]
        });
    }

    async run(message, args)
    {
        if(!signedIntoFirebase || message.guild == null)
            return;
            
        IndexRef.addCommandCounter(message.author.id);
        
        var existingData = false;
        for(var i = 0; i < slaves.length; i++)
        {
            if(slaves[i].key == message.guild.id)
            {
                existingData = true;
            }
        }

        var promises = []

        if(!existingData)
        {
            promises.push(firebase.database().ref("serversettings/" + message.guild.id + "/slaves").once('value').then(function(snapshot){
                if(snapshot.val() == null)
                {
                    var slave = {key: message.guild.id, users: []}
                    slaves.push(slave);
                    firebase.database().ref("serversettings/" + message.guild.id + "/slaves").set(JSON.stringify(slave))
                }
                else
                {
                    var slave = JSON.parse(snapshot.val())
                   
                    if(slave.key != message.guild.id)
                    {
                        slave.key = message.guild.id;
                        firebase.database().ref("serversettings/" + message.guild.id + "/slaves").set(JSON.stringify(slave))
                    }

                    slaves.push(slave)
                }
            }))
        }

        var commandPrefix= "!"
        if(message.guild != null)
        {
            commandPrefix = message.guild.commandPrefix
        }

        setImmediate(() => {
            Promise.all(promises).then(() => {
                for(var i = 0; i < slaves.length; i++)
                {
                    if(slaves[i].key == message.guild.id)
                    {
                        if(args.toLowerCase().startsWith("collect"))
                        {  
                            const date = new Date(IndexRef.getCooldown(message.author.id))

                            if(date == null || date == undefined)
                            {
                                date = new Date()
                            }

                            if(date.getTime() <= (new Date()).getTime())
                            {
                                var maxValue = 2000;
                                var maxPercInc = 0;
                                var collectedValInc = 0;

                                for(var index = 0; index < slaves[i].users.length; index++)
                                {
                                    if(slaves[i].users[index].owner == message.author.id)
                                    {
                                        if(slaves[i].users[index].price > 1000)
                                        {
                                            const amountRef = slaves[i].users[index].price - 1000
                                            maxPercInc = maxPercInc + Math.floor(amountRef / 500)
                                        }
                                    }
                                }

                                for(var index = 0; index < patrons.length; index++)
                                {
                                    if(patrons[index].userID == message.author.id)
                                    {
                                        if(patrons[index].type == 0)
                                        {
                                            collectedValInc = 50;
                                        }
                                        else if(patrons[index].type == 1)
                                        {
                                            collectedValInc = 100;
                                        }
                                    }
                                }

                                if(maxPercInc > 200)
                                    maxPercInc = 200;

                                maxValue = Math.floor(2000 * ((maxPercInc/100) + 1))

                                var collected = Math.floor(Math.random() * maxValue) + 1
                                collected = Math.floor(collected * ((collectedValInc/100) + 1))

                                var timestamp = (new Date(Date.now()).toJSON());

                                IndexRef.addTokens(message.author.id, collected)
                                IndexRef.setCooldown(message.author.id, (new Date((new Date).getTime() + 120000)))

                                message.channel.send("", {embed: {title: "***Slave Trading Resources Collected***", description: "<@" + message.author.id + "> You have collected ***" + numberWithCommas(collected) + " tokens***\n\n***Max value increase of " + maxPercInc + "%*** _(current max value: " + maxValue + ")_ - Increase the max amount of tokens you can collect by owning slaves with a value greater than 1000 tokens.\n\n***Collected Value Increase of " + collectedValInc + "%*** - You can increase the value of tokens you have collected. This is only available to those ***[supporting us on Patreon](https://www.patreon.com/merriemweebster)***.", color: 65339, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Collected on"}}}).catch(error => console.log("Send Error - " + error));
                            }
                            else
                            {
                                message.channel.send("", {embed: {title: "***Cooldown***", description: "<@" + message.author.id + "> You cannot collect more slave trading resources until the 2 minute cooldown is over.", color: 65339, timestamp: IndexRef.getCooldown(message.author.id), footer: {icon_url: message.client.user.avatarURL,text: "Cooldown until"}}}).catch(error => console.log("Send Error - " + error));
                            }
                                
                            
                        }
                        else if(args.toLowerCase().startsWith("give"))
                        {
                            var endIndex = -1;
                            var users = []
                            var getUser = false;
                            var userID = "";
                            for(var index = 0; index < args.length; index++)
                            {
                                if(getUser)
                                {
                                    if(args[index].toString() == ">")
                                    {
                                        users.push(userID);
                                        userID = "";
                                        getUser = false;
                                    }
                                    else
                                    {
                                        if(args[index].toString() != "@" && !isNaN(args[index].toString()))
                                        {
                                            userID = userID + args[index].toString();
                                        }
                                    }
                                }
                                else
                                {
                                    if(args[index].toString() == "<")
                                    {
                                        getUser = true;
                                        if(endIndex == -1)
                                            endIndex = index 
                                    } 
                                }
                            }
    
                            var options = ""
    
                            for(var index = 0; index < endIndex; index++)
                            {
                                options = options + args[index];
                            }
    
                            var amountText = options.match(/\d+/g);
                            var amount = []
                            if(amountText != null)
                            {
                                amount = amountText.map(Number);
                            }

                            if(amount.length > 0)
                            {
                                amount = amount[0]

                                if(users.length > 0)
                                {
                                    for(var userIndex = 0; userIndex < users.length; userIndex++)
                                    {
                                        if(IndexRef.getTokens(message.author.id) < amount)
                                        {
                                            message.channel.send("<@" + message.author.id + "> You do not have " + numberWithCommas(amount) + " tokens to give to another user.").catch(error => {console.log("Send Error - " + error); });   
                                        }
                                        else
                                        {
                                            var mentions = message.mentions.users.array()
                                            var isBot = false;
                                            for(var mentionIndex = 0; mentionIndex < mentions.length; mentionIndex++)
                                            {
                                                if(mentions[mentionIndex].id == users[userIndex])
                                                {
                                                    isBot = mentions[mentionIndex].bot
                                                }
                                            }

                                            if(users[userIndex] == message.author.id || isBot)
                                            {
                                                message.channel.send("<@" + message.author.id + "> tag another user.").catch(error => {console.log("Send Error - " + error); });   
                                            }
                                            else
                                            {
                                                IndexRef.subtractTokens(message.author.id, amount)
                                                IndexRef.addTokens(users[userIndex], amount)
                                                message.channel.send("<@" + message.author.id + "> has given " + numberWithCommas(amount) + " token(s) to <@" + users[userIndex] + ">").catch(error => {console.log("Send Error - " + error); });   
                                            }
                                        }
                                        
                                    }
                                }
                                else
                                {
                                    message.channel.send("<@" + message.author.id + "> No users mentioned.").catch(error => {console.log("Send Error - " + error); });   
                                }
                            }
                            else
                            {
                                message.channel.send("<@" + message.author.id + "> No amount given.").catch(error => {console.log("Send Error - " + error); });   
                            }
                        }
                        else if(args.toLowerCase().startsWith("gift"))
                        {
                            var endIndex = -1;
                            var users = []
                            var getUser = false;
                            var userID = "";
                            for(var index = 0; index < args.length; index++)
                            {
                                if(getUser)
                                {
                                    if(args[index].toString() == ">")
                                    {
                                        users.push(userID);
                                        userID = "";
                                        getUser = false;
                                    }
                                    else
                                    {
                                        if(args[index].toString() != "@" && !isNaN(args[index].toString()))
                                        {
                                            userID = userID + args[index].toString();
                                        }
                                    }
                                }
                                else
                                {
                                    if(args[index].toString() == "<")
                                    {
                                        getUser = true;
                                        if(endIndex == -1)
                                            endIndex = index 
                                    } 
                                }
                            }
    
                            var options = ""
    
                            for(var index = 0; index < endIndex; index++)
                            {
                                options = options + args[index];
                            }
    
                            var amountText = options.match(/\d+/g);
                            var amount = []
                            if(amountText != null)
                            {
                                amount = amountText.map(Number);
                            }

                            if(amount.length > 0)
                            {
                                amount = amount[0]

                                if(users.length > 0)
                                {
                                    for(var userIndex = 0; userIndex < users.length; userIndex++)
                                    {
                                        if(IndexRef.getTokens(message.author.id) < amount)
                                        {
                                            message.channel.send("<@" + message.author.id + "> You do not have " + numberWithCommas(amount) + " tokens to gift to your slave.").catch(error => {console.log("Send Error - " + error); });   
                                        }
                                        else
                                        {
                                            var mentions = message.mentions.users.array()
                                            var isBot = false;
                                            for(var mentionIndex = 0; mentionIndex < mentions.length; mentionIndex++)
                                            {
                                                if(mentions[mentionIndex].id == users[userIndex])
                                                {
                                                    isBot = mentions[mentionIndex].bot
                                                }
                                            }

                                            var owner = false;

                                            for(var slaveIndex = 0; slaveIndex < slaves[i].users.length; slaveIndex++)
                                            {
                                                if(slaves[i].users[slaveIndex].owner == message.author.id)
                                                {
                                                    owner = true;
                                                }
                                            }

                                            if(users[userIndex] == message.author.id || isBot || !owner)
                                            {
                                                message.channel.send("<@" + message.author.id + "> tag a slave you own.").catch(error => {console.log("Send Error - " + error); });   
                                            }
                                            else
                                            {
                                                IndexRef.subtractTokens(message.author.id, amount)
                                                IndexRef.addTokens(users[userIndex], amount)
                                                var newPrice = 0;

                                                for(var slaveIndex = 0; slaveIndex < slaves[i].users.length; slaveIndex++)
                                                {
                                                    if(slaves[i].users[slaveIndex].id == users[userIndex])
                                                    {
                                                        newPrice = slaves[i].users[slaveIndex].price + Math.floor((Math.random() * amount) + 1)
                                                        slaves[i].users[slaveIndex].price = newPrice
                                                    }
                                                }

                                                message.channel.send("<@" + message.author.id + "> has given " + numberWithCommas(amount) + " token(s) to their slave. <@" + users[userIndex] + "> now has a value of " + numberWithCommas(newPrice) + " war tokens.").catch(error => {console.log("Send Error - " + error); });                                                   
                                            }
                                        }
                                        
                                    }
                                }
                                else
                                {
                                    message.channel.send("<@" + message.author.id + "> No users mentioned.").catch(error => {console.log("Send Error - " + error); });   
                                }
                            }
                            else
                            {
                                message.channel.send("<@" + message.author.id + "> No amount given.").catch(error => {console.log("Send Error - " + error); });   
                            }
                        }
                        else if (args.toLowerCase().startsWith("buy"))
                        {
                            var otherUser = false;
                            var userID = "";
                            var getUser = false;
                            for(var index = 0; index < args.length; index++)
                            {
                                if(getUser)
                                {
                                    if(args[index].toString() == ">")
                                    {
                                        index = args.length;
                                        otherUser = true;
                                    }
                                    else
                                    {
                                        if(args[index].toString() != "@" && (!isNaN(args[index].toString()) || args[index] == "&"))
                                        {
                                            userID = userID + args[index].toString();
                                        }
                                    }
                                }
                                else
                                {
                                    if(args[index].toString() == "<")
                                    {
                                        getUser = true;
                                    } 
                                }
                            }

                            var timestamp = (new Date(Date.now()).toJSON());
                            var mentions = message.mentions.users.array()
                            var isBot = false;
                            for(var mentionIndex = 0; mentionIndex < mentions.length; mentionIndex++)
                            {
                                if(mentions[mentionIndex].id == userID)
                                {
                                    isBot = mentions[mentionIndex].bot
                                }
                            }

                            if(otherUser && userID != message.author.id && !isBot)
                            {
                                var slaveFound = false;
                                var selfOwner = "none"

                                for(var slaveIndex = 0; slaveIndex < slaves[i].users.length; slaveIndex++)
                                {
                                    if(slaves[i].users[slaveIndex].id == message.author.id)
                                    {
                                        if(slaves[i].users[slaveIndex].owner != "")
                                        {
                                            selfOwner = slaves[i].users[slaveIndex].owner
                                        }
                                    }
                                }

                                for(var slaveIndex = 0; slaveIndex < slaves[i].users.length; slaveIndex++)
                                {
                                    if(slaves[i].users[slaveIndex].id == userID)
                                    {
                                        slaveFound = true;
                                        var value = slaves[i].users[slaveIndex].price;
    
                                        if(slaves[i].users[slaveIndex].owner == message.author.id)
                                        {
                                            message.channel.send("", {embed: {title: "***Slave Already Owned***", description: "<@" + message.author.id + "> You already own <@" + userID + ">", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                        }
                                        else if(slaves[i].users[slaveIndex].owner != "")
                                        {
                                            message.channel.send("", {embed: {title: "***Slave Already Owned***", description: "<@" + slaves[i].users[slaveIndex].owner + "> owns <@" + userID + ">", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                        }
                                        else if(slaves[i].users[slaveIndex].id == selfOwner)
                                        {
                                            message.channel.send("", {embed: {title: "***Cannot Own Your Master***", description: "<@" + slaves[i].users[slaveIndex].id + "> owns you.", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                        }
                                        else
                                        {
                                            if(!IndexRef.subtractTokens(message.author.id, value))
                                            {
                                                message.channel.send("", {embed: {title: "***Failed To Buy Slave***", description: "<@" + message.author.id + "> You do not have enough tokens to purchase <@" + userID + ">. You need " + numberWithCommas(value) + " tokens, while you only have " + numberWithCommas(IndexRef.getTokens(message.author.id)) + " tokens.", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                            }
                                            else
                                            {                                                
                                                message.channel.send("", {embed: {title: "***Successfully Purchased Slave***", description: "<@" + message.author.id + "> You have purchased <@" + userID + ">. You now have " + numberWithCommas(IndexRef.getTokens(message.author.id)) + " tokens.", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                                
                                                slaves[i].users[slaveIndex].owner = message.author.id;
                                            }
                                        }
                                    }
                                }

                                if(!slaveFound)
                                {
                                    var value = 500;
    
                                    if(!IndexRef.subtractTokens(message.author.id, value))
                                    {
                                        message.channel.send("", {embed: {title: "***Failed To Buy Slave***", description: "<@" + message.author.id + "> You do not have enough tokens to purchase <@" + userID + ">. You need " + numberWithCommas(value) + " tokens, while you only have " + numberWithCommas(IndexRef.getTokens(message.author.id)) + " tokens.", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                        slaves[i].users.push({id: userID,  owner: "", price: 500})
                                    }
                                    else
                                    {                                                
                                        message.channel.send("", {embed: {title: "***Successfully Purchased Slave***", description: "<@" + message.author.id + "> You have purchased <@" + userID + ">. You now have " + numberWithCommas(IndexRef.getTokens(message.author.id)) + " tokens.", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                        slaves[i].users.push({id: userID,  owner: message.author.id, price: 500})
                                    }
                                }
                            }
                            else
                            {
                                message.channel.send("", {embed: {title: "***No Slaves Tagged***", description: "<@" + message.author.id + "> You must mention a slave to buy them.", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                            }
                        }
                        else if (args.toLowerCase().startsWith("sell"))
                        {
                            var otherUser = false;
                            var userID = "";
                            var getUser = false;
                            for(var index = 0; index < args.length; index++)
                            {
                                if(getUser)
                                {
                                    if(args[index].toString() == ">")
                                    {
                                        index = args.length;
                                        otherUser = true;
                                    }
                                    else
                                    {
                                        if(args[index].toString() != "@" && (!isNaN(args[index].toString()) || args[index] == "&"))
                                        {
                                            userID = userID + args[index].toString();
                                        }
                                    }
                                }
                                else
                                {
                                    if(args[index].toString() == "<")
                                    {
                                        getUser = true;
                                    } 
                                }
                            }

                            var timestamp = (new Date(Date.now()).toJSON());
                            var mentions = message.mentions.users.array()
                            var isBot = false;
                            for(var mentionIndex = 0; mentionIndex < mentions.length; mentionIndex++)
                            {
                                if(mentions[mentionIndex].id == userID)
                                {
                                    isBot = mentions[mentionIndex].bot
                                }
                            }

                            if(otherUser && userID != message.author.id && !isBot)
                            {
                                var slaveFound = false;
                                for(var slaveIndex = 0; slaveIndex < slaves[i].users.length; slaveIndex++)
                                {
                                    if(slaves[i].users[slaveIndex].id == userID)
                                    {
                                        slaveFound = true;
                                        var value = slaves[i].users[slaveIndex].price;
    
                                        if(slaves[i].users[slaveIndex].owner == message.author.id)
                                        {
                                            IndexRef.addTokens(message.author.id, slaves[i].users[slaveIndex].price)
                                            message.channel.send("", {embed: {title: "***Successfully Sold Slave***", description: "<@" + message.author.id + "> You have sold <@" + userID + "> for " + numberWithCommas(slaves[i].users[slaveIndex].price) + " tokens. You now have " + numberWithCommas(IndexRef.getTokens(message.author.id)) + " tokens.", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                            slaves[i].users[slaveIndex].owner = ""
                                            slaves[i].users[slaveIndex].price = slaves[i].users[slaveIndex].price + 500;
                                        }
                                        else
                                        {
                                            message.channel.send("", {embed: {title: "***Slave Not Owned***", description: "<@" + message.author.id + "> You do not own <@" + userID + ">", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                        }
                                    }
                                }

                                if(!slaveFound)
                                {
                                    message.channel.send("", {embed: {title: "***Slave Not Owned***", description: "<@" + message.author.id + "> You do not own <@" + userID + ">", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                    slaves[i].users.push({id: userID,  owner: "", price: 500})
                                }
                            }
                            else
                            {
                                message.channel.send("", {embed: {title: "***No Slaves Tagged***", description: "<@" + message.author.id + "> You must mention a slave to buy them.", color: 16711680, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                            }
                        }
                        else if(args.toLowerCase().startsWith("profile"))
                        {
                            var otherUser = false;
                            var userID = "";
                            var getUser = false;
                            for(var index = 0; index < args.length; index++)
                            {
                                if(getUser)
                                {
                                    if(args[index].toString() == ">")
                                    {
                                        index = args.length;
                                        otherUser = true;
                                    }
                                    else
                                    {
                                        if(args[index].toString() != "@" && (!isNaN(args[index].toString()) || args[index] == "&"))
                                        {
                                            userID = userID + args[index].toString();
                                        }
                                    }
                                }
                                else
                                {
                                    if(args[index].toString() == "<")
                                    {
                                        getUser = true;
                                    } 
                                }
                            }
                            
        
                            if(otherUser)
                            {
                                var slaveFound = false;
                                var timestamp = (new Date(Date.now()).toJSON());
                                var count = 0;
                                for(var slaveIndex = 0; slaveIndex < slaves[i].users.length; slaveIndex++)
                                {
                                    if(slaves[i].users[slaveIndex].owner == userID)
                                    {
                                        count++;
                                    }
                                }

                                var user;
                                var mentions = message.mentions.users.array()

                                for(var mentionIndex = 0; mentionIndex < mentions.length; mentionIndex++)
                                {
                                    if(mentions[mentionIndex].id == userID)
                                    {
                                        user = mentions[mentionIndex];
                                    }
                                }

                                var thumbnail = "";
    
                                if(user.avatarURL != undefined && user.avatarURL != null)
                                    thumbnail = user.avatarURL

                                for(var slaveIndex = 0; slaveIndex < slaves[i].users.length; slaveIndex++)
                                {
                                    if(slaves[i].users[slaveIndex].id == userID)
                                    {
                                        var price = slaves[i].users[slaveIndex].price;
                                        slaveFound = true
                                        var ownerText = ""

                                        if(slaves[i].users[slaveIndex].owner != "")
                                        {
                                            ownerText = "\n\nThis slave is owned by <@" + slaves[i].users[slaveIndex].owner + ">"
                                        }
                                        else
                                        {
                                            ownerText = "\n\nThis slave is not owned by anyone."
                                        }

                                        message.channel.send("", {embed: {title: "***Slave Profile for" + user.username + "***", description: user.username + " currently has " + numberWithCommas(IndexRef.getTokens(user.id)) + " tokens.\n " + user.username + " owns " + count + " slave(s).\n" + user.username + " is worth " + numberWithCommas(price) + " war tokens." + ownerText, color: 16711680, thumbnail: {"url": thumbnail}, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                    }
                                }

                                if(!slaveFound)
                                {
                                    message.channel.send("", {embed: {title: "***Slave Profile for" + user.username + "***", description: user.username + " currently has " + numberWithCommas(IndexRef.getTokens(user.id)) + " tokens.\n " + user.username + " owns " + count + " slave(s).\n" + user.username + " is worth 500 war tokens.\n\nThis slave is not owned by anyone.", color: 16711680, thumbnail: {"url": thumbnail}, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));
                                    slaves[i].users.push({id: userID,  owner: "", price: 500})
                                }
                            }
                            else
                            {
                                var count = 0;
                                var price = 500;
                                var slaveFound = false;
                                var ownerText = ""
                                
                                for(var slaveIndex = 0; slaveIndex < slaves[i].users.length; slaveIndex++)
                                {
                                    if(slaves[i].users[slaveIndex].owner == message.author.id)
                                    {
                                        count++;
                                    }

                                    if(slaves[i].users[slaveIndex].id == message.author.id)
                                    {
                                        price = slaves[i].users[slaveIndex].price;
                                        slaveFound = true;
                                        
                                        if(slaves[i].users[slaveIndex].owner != "")
                                        {
                                            ownerText = "\n\You are owned by <@" + slaves[i].users[slaveIndex].owner + ">"
                                        }
                                        else
                                        {
                                            ownerText = "\n\nYou are not owned by anyone."
                                        }
                                    }
                                }

                                if(!slaveFound)
                                {
                                    slaves[i].users.push({id: message.author.id,  owner: "", price: 500})
                                }
    
                                var thumbnail = "";
    
                                if(message.author.avatarURL != undefined && message.author.avatarURL != null)
                                    thumbnail = message.author.avatarURL
    
                                var timestamp = (new Date(Date.now()).toJSON());
                                message.channel.send("", {embed: {title: "***Slave Profile for " + message.author.username + "***", description: "You currently have " + numberWithCommas(IndexRef.getTokens(message.author.id)) + " tokens.\nYou own " + count + " slave(s).\nYou are worth " + price + " war tokens." + ownerText, color: 16711680, thumbnail: {"url": thumbnail}, timestamp: timestamp, footer: {icon_url: message.client.user.avatarURL,text: "Sent on"}}}).catch(error => console.log("Send Error - " + error));    
                            }
                        }
                        else
                        {
                            message.channel.send("<@" + message.author.id + "> No parameter given. Use `" + commandPrefix + "help warslave` for help.").catch(error => {console.log("Send Error - " + error); });
                        }
                    
                        firebase.database().ref("serversettings/" + message.guild.id + "/slaves").set(JSON.stringify(slaves[i]))
                        return;
                    }
                }
            })
        })
    }
}

module.exports = WarSlaveCommand;