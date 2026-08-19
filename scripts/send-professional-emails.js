#!/usr/bin/env node

/**
 * Send professional HTML email templates via Supabase
 *
 * Usage: node scripts/send-professional-emails.js
 *
 * This script sends the two professional email templates to a test address
 * to verify rendering before sending to actual candidates.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://xqwvqrwovvpnbxfdwgpq.supabase.co';
const SUPABASE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3d3ZxcndvdnZwbmJ4ZmR3Z3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwNzM5MTAsImV4cCI6MTkwMDAwMzkxMH0.HnEF5bvt7vJf5F_FzpzJCQzS1sKHJ8vqH-h0k-BbL4I';

const RECIPIENT = 'vmn2k4@gmail.com';
const REPLY_TO = 'vijay@choseno.com';

/**
 * Send an email via Supabase send-email function
 */
function sendEmail(to, subject, html) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      to,
      subject,
      html,
      replyTo: REPLY_TO
    });

    const options = {
      hostname: 'xqwvqrwovvpnbxfdwgpq.supabase.co',
      path: '/functions/v1/send-email',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          resolve({ raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Main function
 */
async function main() {
  try {
    // Read templates
    const mayorHtml = fs.readFileSync(
      path.join(__dirname, '../email-templates/mayor-professional.html'),
      'utf-8'
    );

    const councillorHtml = fs.readFileSync(
      path.join(__dirname, '../email-templates/councillor-professional.html'),
      'utf-8'
    );

    console.log('📧 Professional Email Template Sender');
    console.log('====================================\n');

    // Send mayor email
    console.log('📤 Sending Mayor email to', RECIPIENT);
    const mayorResult = await sendEmail(
      RECIPIENT,
      'Test: Your Mayor Wall is Ready on Choseno — Professional Design',
      mayorHtml
    );

    if (mayorResult.ok || mayorResult.sent) {
      console.log('✅ Mayor email sent successfully!\n');
    } else {
      console.log('⚠️  Mayor email response:', mayorResult, '\n');
    }

    // Send councillor email
    console.log('📤 Sending Councillor email to', RECIPIENT);
    const councillorResult = await sendEmail(
      RECIPIENT,
      'Test: Your Councillor Wall is Ready on Choseno — Professional Design',
      councillorHtml
    );

    if (councillorResult.ok || councillorResult.sent) {
      console.log('✅ Councillor email sent successfully!\n');
    } else {
      console.log('⚠️  Councillor email response:', councillorResult, '\n');
    }

    console.log('Check your inbox at', RECIPIENT, 'to preview the emails!');
    console.log('\nNext steps:');
    console.log('1. Review the emails in your inbox');
    console.log('2. Check rendering in Gmail, Outlook, and other clients');
    console.log('3. Update [Name], [City], and [wall_slug] placeholders as needed');
    console.log('4. Send to actual candidates when ready');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { sendEmail };
