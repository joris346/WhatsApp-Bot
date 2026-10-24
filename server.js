const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
console.log('=== BOT STARTET ===');
async function startBot(){
 try{
  const {state, saveCreds} = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({
    version: [2, 3000, 1023223821],
    auth: state,
    logger: P({level: 'silent'}),
    browser: ['Chrome','Chrome','1.0']
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if(qr){
      console.log('====== QR CODE ZUM SCANNEN ======');
      qrcode.generate(qr, {small: true});
      console.log(qr);
      console.log('=================================');
    }
    if(connection === 'close'){
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log('Geschlossen! Code:', reason);
      if(reason !== DisconnectReason.loggedOut){
        console.log('Neustart in 5 Sek...');
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
    if(txt.toLowerCase()==='.menu') await sock.sendMessage(gid,{text:'Befehle: .menu'});
  });
  console.log('Bot wartet auf QR...');
 } catch(e){ console.log('FEHLER:', e); }
}
startBot();
app.get('/',(r,s)=>s.send('Bot laeuft'));
app.listen(PORT,()=>console.log('Server auf '+PORT));
