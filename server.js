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
      console.log('Geschlossen! Grund Code:', reason, lastDisconnect?.error?.message);
      if(reason !== DisconnectReason.loggedOut){
        console.log('Versuche in 5 Sek neu...');
        setTimeout(startBot, 5000);
      } else {
        console.log('Ausgeloggt - Auth Ordner löschen nötig');
      }
    }
    if(connection === 'open'){
      console.log('### BOT IST VERBUNDEN!!! ###');
    }
  });
  sock.ev.on('messages.upsert', async({messages})=>{
    const msg=messages[0]; if(!msg.message||msg.key.fromMe) return;
    const gid=msg.key.remoteJid; if(!gid.endsWith('@g.us')) return;
    const txt=(msg.message.conversation||msg.message.extendedTextMessage?.text||'').trim();
    if(!txt.startsWith('.')) return;
    const cmd=txt.slice(1).split(' ')[0].toLowerCase();
    if(cmd==='menu') await sock.sendMessage(gid,{text:'Befehle: .menu .admins .kick @user'});
  });
  console.log('Bot wartet auf QR - bitte 20 Sek warten...');
 } catch(e){
  console.log('FEHLER:', e);
 }
}
startBot();
app.get('/',(req,res)=>res.send('Bot läuft - schau in Logs'));
app.listen(PORT,()=>console.log('Server auf '+PORT));
