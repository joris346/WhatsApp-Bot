const express = require('express');
const app = express();
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');

let warns = {};
let qrText = 'Warte auf QR...';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }) });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    if (u.qr) {
      qrText = u.qr;
      qrcode.generate(u.qr, { small: true });
      console.log('QR DA!');
    }
    if (u.connection === 'open') {
      qrText = 'VERBUNDEN!';
      console.log('BOT VERBUNDEN!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const groupId = msg.key.remoteJid;
    if (!groupId.endsWith('@g.us')) return;
    const txt = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
    if (!txt.startsWith('.')) return;
    const args = txt.slice(1).split(' ');
    const cmd = args[0].toLowerCase();
    const meta = await sock.groupMetadata(groupId);
    const sender = msg.key.participant;
    const isAdmin = meta.participants.find(p => p.id === sender)?.admin;
    const botIsAdmin = meta.participants.find(p => p.id === sock.user.id)?.admin;

    if (cmd === 'kick') {
      if (!isAdmin) return sock.sendMessage(groupId, { text: 'Nur Admins!' });
      if (!botIsAdmin) return sock.sendMessage(groupId, { text: 'Mach mich zum Admin!' });
      const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!target) return;
      await sock.groupParticipantsUpdate(groupId, [target], 'remove');
      await sock.sendMessage(groupId, { text: `Gekickt @${target.split('@')[0]}`, mentions: [target] });
    }
    if (cmd === 'warn') {
      if (!isAdmin) return;
      const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!target) return;
      warns[target] = (warns[target] || 0) + 1;
      if (warns[target] >= 3) {
        await sock.groupParticipantsUpdate(groupId, [target], 'remove');
        warns[target] = 0;
        await sock.sendMessage(groupId, { text: `3 Warns = Kick @${target.split('@')[0]}`, mentions: [target] });
      } else {
        await sock.sendMessage(groupId, { text: `Warn ${warns[target]}/3 @${target.split('@')[0]}`, mentions: [target] });
      }
    }
    if (cmd === 'admins') {
      const admins = meta.participants.filter(p => p.admin);
      const txt = admins.map(a => `@${a.id.split('@')[0]}`).join('\n');
      await sock.sendMessage(groupId, { text: `Admins:\n${txt}`, mentions: admins.map(a => a.id) });
    }
    if (cmd === 'menu') {
      await sock.sendMessage(groupId, { text: 'Befehle:\n.kick @user\n.warn @user\n.admins\n.menu' });
    }
  });
}

startBot();
app.get('/', (req,res) => res.send(`<h1>Bot Status: ${qrText}</h1><p>Log bei Render angucken fuer QR</p>`));
app.listen(3000, () => console.log('Server 3000'));
