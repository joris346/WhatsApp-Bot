const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');

console.log('Bot startet...');

async function startBot(){
 try{
  const {state,saveCreds}=await useMultiFileAuthState('./auth');
  const sock=makeWASocket({auth:state,logger:P({level:'silent'}),browser:['Chrome','Chrome','1.0']});
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',(u)=>{
    if(u.qr){
      console.log('=== QR CODE ===');
      qrcode.generate(u.qr,{small:true});
      console.log(u.qr);
    }
    if(u.connection==='open') console.log('BOT VERBUNDEN!');
  });
  sock.ev.on('messages.upsert',async({messages})=>{
    const msg=messages[0]; if(!msg.message||msg.key.fromMe) return;
    const gid=msg.key.remoteJid; if(!gid.endsWith('@g.us')) return;
    const txt=(msg.message.conversation||msg.message.extendedTextMessage?.text||'').trim();
    if(!txt.startsWith('.')) return;
    const cmd=txt.slice(1).split(' ')[0].toLowerCase();
    const meta=await sock.groupMetadata(gid);
    const sender=msg.key.participant;
    const isAdmin=meta.participants.find(p=>p.id===sender)?.admin;
    const botIsAdmin=meta.participants.find(p=>p.id===sock.user.id)?.admin;
    if(cmd==='kick'){
      if(!isAdmin) return;
      const target=msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if(target){ await sock.groupParticipantsUpdate(gid,[target],'remove'); await sock.sendMessage(gid,{text:`Gekickt`}); }
    }
    if(cmd==='menu'){ await sock.sendMessage(gid,{text:'.kick @user\n.warn @user\n.admins\n.menu'}); }
    if(cmd==='admins'){
      const admins=meta.participants.filter(p=>p.admin).map(a=>`@${a.id.split('@')[0]}`).join('\n');
      await sock.sendMessage(gid,{text:`Admins:\n${admins}`});
    }
  });
 }catch(e){console.log('Fehler:',e.message);}
}
startBot();
app.get('/',(req,res)=>res.send('Bot laeuft - QR im Render Log ansehen'));
app.listen(PORT,()=>console.log('Server auf '+PORT));
