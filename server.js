const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');

console.log('=== BOT STARTET... ===');

async function startBot(){
 console.log('Auth wird geladen...');
 const {state, saveCreds} = await useMultiFileAuthState('./auth');
 console.log('Socket wird erstellt...');
 const sock = makeWASocket({
   auth: state,
   logger: P({level: 'silent'}),
   printQRInTerminal: true,
   browser: ['Chrome','Chrome','1.0']
 });
 sock.ev.on('creds.update', saveCreds);
 sock.ev.on('connection.update', (u) => {
   const { connection, lastDisconnect, qr } = u;
   if(qr){
     console.log('============================');
     console.log('=== HIER IST DEIN QR CODE ===');
     qrcode.generate(qr, {small: true});
     console.log(qr);
     console.log('============================');
   }
   if(connection === 'open'){
     console.log('### BOT VERBUNDEN!!! ###');
   }
   if(connection === 'close'){
     console.log('Verbindung geschlossen, neu starten...');
     startBot();
   }
 });
 sock.ev.on('messages.upsert', async({messages})=>{
   const msg=messages[0]; if(!msg.message || msg.key.fromMe) return;
   const gid=msg.key.remoteJid; if(!gid.endsWith('@g.us')) return;
   const txt=(msg.message.conversation||msg.message.extendedTextMessage?.text||'').trim();
   if(!txt.startsWith('.')) return;
   const cmd=txt.slice(1).split(' ')[0].toLowerCase();
   const meta=await sock.groupMetadata(gid);
   const sender=msg.key.participant;
   const isAdmin=meta.participants.find(p=>p.id===sender)?.admin;
   if(cmd==='menu'){ await sock.sendMessage(gid,{text:'Befehle:\n.menu\n.admins\n.kick @user'}); }
   if(cmd==='admins'){
     const admins=meta.participants.filter(p=>p.admin).map(a=>`@${a.id.split('@')[0]}`).join('\n');
     await sock.sendMessage(gid,{text:`Admins:\n${admins}`});
   }
   if(cmd==='kick' && isAdmin){
     const target=msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
     if(target){ await sock.groupParticipantsUpdate(gid,[target],'remove'); }
   }
 });
 console.log('Bot wartet auf QR...');
}
startBot();
app.get('/',(req,res)=>res.send('Bot laeuft! Schau in die Logs fuer QR'));
app.listen(PORT,()=>console.log('Server auf '+PORT));
