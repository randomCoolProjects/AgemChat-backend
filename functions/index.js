const functions = require('firebase-functions');
const admin = require('firebase-admin');
const spawn = require('child-process-promise').spawn;
const cors = require('cors')({origin: true});
admin.initializeApp();

//const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

exports.addMessage = functions.https.onRequest(async (req, res) => {

    return cors(req, res, () => {

    function getparam(name)
    {
        if (name in req.query) return req.query[name];
        if (name in req.body) return req.body[name];
        if ('data' in req.body && name in req.body.data) return req.body.data[name];
        return null;
    }

    function param(name)
    {
        if (typeof print == 'undefined')
            function print(n){}
        var val = getparam(name);
        print(`${name} = ${val}`);
        return val;
    }

    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', '*');

    const database = admin.database();
    const messaging = admin.messaging();

    //version/group
    //[beta|relase]/group

    const version = param('version');
    const group = param('group');
    var senderEmail;
    try {
        senderEmail = decodeURIComponent(param('email'));
    }
    catch (ex)
    {
        console.error(`Couldn't decode ${param('email')}`);
        return;
    }

    // /version/msg/group/msg/index

    var LOG_TXT = '';

    function print(txt) {
        LOG_TXT += txt + '\n';
    }

    print('BODY:' + JSON.stringify(req.body));
    print('QUERY:' + JSON.stringify(req.query));

    //print(JSON.stringify(paramsObj));
    print(`VER: ${version}\nGRP: ${group}\nEML: ${senderEmail}`);
    const __path = `${version}/msg/${group}/msgcount`;
    const countRef = database.ref(__path);


    var ctListener = countRef.on('value', snap => {
        countRef.off('value', ctListener);

        LOG_TXT += 'Step 1';
        const count = snap.val();
        if (!count || count <= 0) return;
        const _path = `${version}/msg/${group}/msg/${count-1}`;
        const lastMsg = database.ref(_path);
        var lastMsgListener = lastMsg.on('value', snap => {
            lastMsg.off('value', lastMsgListener);

            print('Step 2');
            const msg = snap.val();
            print(` * MSG: ${JSON.stringify(msg)}`);
            const groupUsers = database.ref(`${version}/msg/${group}/users`);
            var gpUsersListener = groupUsers.on('value', snap => {
                groupUsers.off('value', gpUsersListener);

                print('Step 3');
                const users = snap.val();
                print(JSON.stringify(users));

                const emails = Object.keys(users);
                emails.forEach(userEmail => {
                    if (userEmail == senderEmail) return;
                    print('Step 4');
                    if (!users[userEmail]) return;
                    const usrdata = database.ref(`${version}/usrdata/${userEmail}/notfToken`);
                    var usrdataListener = usrdata.on('value', snap => {
                        usrdata.off('value', usrdataListener);

                        var token = snap.val();

                        print('\nStep 5 (' + token||'NULL' + ') => ' + userEmail);

                        if (!token) {
                            print(`NO TOKEN [${userEmail}]`);
                            return;
                        }

                        var payload = {
                            notification: {
                                title: `🗨 [${group}] ` + msg.sender,
                                body: msg.content,
                            }
                        };
                        LOG_TXT += ' ............. ';
                        print('Sent to: ' + token + '\n' + 'NOTF:\n' + JSON.stringify(payload));

                        messaging.sendToDevice(token, payload);
                    });
                });
            });
        });
    });

    //return res.end('Okk');

    //for DEBUG only
    setTimeout(() => {
        res.json({data: LOG_TXT});
    }, 15000);

});

});