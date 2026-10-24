const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const { Boom } = require('@hapi/boom');

const PHONE_NUMBER = '4915678337795';

console.log('=== BOT STARTET ===');

async function startBot(){
  const {state, saveCreds} = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({
    version: [2, 3000, 1023223821],
    auth: state,
    logger: P({level: 'silent'}),
    browser: ['Ubuntu','Chrome','110.0.5481.178'],
    printQRInTerminal: false
  });

  if(!sock.authState.creds.registered){
    setTimeout(async () => {
      try{
        let code = await sock.requestPairingCode(PHONE_NUMBER);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log('=================================');
        console.log('DEIN PAIRING CODE: ' + code);
        console.log('=================================');
      } catch(e){ console.log('Pairing Fehler:', e.message); }
    }, 5000);
  }

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u;
    if(connection === 'close'){
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log('Geschlossen! Code:', reason);
      if(reason !== DisconnectReason.loggedOut){
        setTimeout(startBot, 5000);
      }
    }
    if(connection === 'open'){
      console.log('### BOT VERBUNDEN!!! ###');
    }
  });

  sock.ev.on('messages.upsert', async({messages})=>{
    const m=messages[0]; if(!m.message||m.key.fromMe) return;
    const gid=m.key.remoteJid; if(!gid.endsWith('@g.us')) return;
    const txt=(m.message.conversation||m.message.extendedTextMessage?.text||'').trim();
    if(!txt.startsWith('.')) return;
    if(txt.toLowerCase()==='.menu') await sock.sendMessage(gid,{text:'Bot online! .menu .admins'});
  });
  console.log('Bot wartet auf Pairing...');
}
startBot();
app.get('/',(r,s)=>s.send('Bot laeuft - Pairing Code in Logs'));
app.listen(PORT,()=>console.log('Server auf '+PORT));
