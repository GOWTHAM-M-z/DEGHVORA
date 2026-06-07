const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Local Backup Fallback System (Ensures data is saved even if MongoDB is down)
async function saveToLocalBackup(contactData) {
    try {
        const filePath = path.join(__dirname, '..', 'contacts.json');
        let contacts = [];
        
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            contacts = JSON.parse(fileContent || '[]');
        }
        
        contacts.push({
            ...contactData,
            createdAt: new Date().toISOString()
        });
        
        fs.writeFileSync(filePath, JSON.stringify(contacts, null, 2), 'utf8');
        console.log('Saved contact submission locally in backup: contacts.json');
        return true;
    } catch (err) {
        console.error('Failed to write to local backup file:', err);
        return false;
    }
}

// POST /contact API Endpoint
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // 1. Core input validations
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Name is a required field.' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, error: 'Email is a required field.' });
        }
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message is a required field.' });
        }

        // Email format check
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
        }

        // 2. Try persisting contact in MongoDB via Mongoose
        let savedInDB = false;
        const mongooseConnectionState = req.app.get('dbConnectionState');

        if (mongooseConnectionState === 1) { // Mongoose state 1 means connected
            try {
                const newContact = new Contact({
                    name,
                    email,
                    phone: phone || '',
                    subject: subject || '',
                    message
                });
                await newContact.save();
                console.log(`Successfully stored submission from ${name} inside MongoDB.`);
                savedInDB = true;
            } catch (dbErr) {
                console.error('Mongoose schema persistence failed, triggering local backup:', dbErr.message);
            }
        }

        // 3. Graceful Local Fallback if Database is offline
        if (!savedInDB) {
            console.log('MongoDB server is offline. Writing contact record to local contacts.json backup file...');
            await saveToLocalBackup({
                name,
                email,
                phone: phone || '',
                subject: subject || '',
                message
            });
        }

        // 4. Nodemailer Setup & SMTP dispatch
        const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;
        const receiverEmail = process.env.RECEIVER_EMAIL || 'deghvora@gmail.com';

        const isEmailConfigured = 
            emailUser && 
            emailUser.trim() !== '' &&
            emailUser !== 'your-email@gmail.com' && 
            emailPass && 
            emailPass.trim() !== '' &&
            emailPass !== 'your-google-app-password' && 
            emailPass !== 'your_gmail_app_password';

        if (isEmailConfigured) {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465, // true for 465, false for other ports
                auth: {
                    user: emailUser,
                    pass: emailPass
                }
            });

            // Production-grade branded responsive HTML email alert layout
            const emailHtml = `
                <div style="font-family: 'Poppins', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eae5f3; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 35px rgba(128, 0, 128, 0.04);">
                    <!-- Header Banner -->
                    <div style="background: linear-gradient(135deg, #800080 0%, #4c004c 100%); padding: 40px 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">DEGHVORA</h1>
                        <p style="color: #eccdec; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">New Contact Form Submission</p>
                    </div>
                    
                    <!-- Content Block -->
                    <div style="padding: 35px 30px; background-color: #ffffff; color: #1a1a1a;">
                        <p style="font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 25px; color: #444444;">
                            Hello team, a client has submitted their contact request on your website. Here are the captured details:
                        </p>
                        
                        <!-- Client Parameters Table -->
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                            <tr style="border-bottom: 1px solid #f2ecf5;">
                                <td style="padding: 14px 10px; font-weight: 600; color: #800080; width: 35%; font-size: 14px;">Client Name:</td>
                                <td style="padding: 14px 10px; color: #333333; font-size: 14px;">${name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f2ecf5;">
                                <td style="padding: 14px 10px; font-weight: 600; color: #800080; font-size: 14px;">Email Address:</td>
                                <td style="padding: 14px 10px; font-size: 14px;">
                                    <a href="mailto:${email}" style="color: #800080; text-decoration: none; font-weight: 500;">${email}</a>
                                </td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f2ecf5;">
                                <td style="padding: 14px 10px; font-weight: 600; color: #800080; font-size: 14px;">Phone Number:</td>
                                <td style="padding: 14px 10px; color: #333333; font-size: 14px;">${phone ? phone : '<em style="color:#999;">Not Provided</em>'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f2ecf5;">
                                <td style="padding: 14px 10px; font-weight: 600; color: #800080; font-size: 14px;">Subject:</td>
                                <td style="padding: 14px 10px; color: #333333; font-size: 14px; font-weight: 500;">${subject ? subject : '<em style="color:#999;">Not Provided</em>'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f2ecf5;">
                                <td style="padding: 14px 10px; font-weight: 600; color: #800080; font-size: 14px;">Timestamp:</td>
                                <td style="padding: 14px 10px; color: #666666; font-size: 13px;">${new Date().toLocaleString()}</td>
                            </tr>
                        </table>
                        
                        <!-- Client Message Box -->
                        <div>
                            <h3 style="color: #800080; font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">Message Content:</h3>
                            <div style="background-color: #faf7fc; border-left: 4px solid #800080; border-radius: 8px; padding: 20px; font-style: italic; color: #3d3d3d; line-height: 1.7; font-size: 15px; white-space: pre-wrap;">
                                ${message}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #faf9fb; border-top: 1px solid #ede7f3; padding: 25px; text-align: center; color: #888888; font-size: 12px;">
                        <p style="margin: 0 0 6px 0; font-weight: 500;">This system notification was auto-generated by the DEGHVORA backend portal.</p>
                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} DEGHVORA | Build Beyond Limits</p>
                    </div>
                </div>
            `;

            const mailOptions = {
                from: `"DEGHVORA Contact Portal" <${emailUser}>`,
                to: receiverEmail,
                subject: `New Client Submission [${subject || 'General Inquiry'}]: ${name}`,
                html: emailHtml,
                replyTo: email
            };

            await transporter.sendMail(mailOptions);
            console.log(`SMTP Alert successfully dispatched to ${receiverEmail}.`);
        } else {
            console.log('\n--- [EMAIL MOCK FALLBACK ALERT] ---');
            console.log(`To Send Live Emails: Set valid credentials inside the .env file.`);
            console.log(`Destination Inbox: ${receiverEmail}`);
            console.log(`Parameters Received:`);
            console.log(`  - Name:    ${name}`);
            console.log(`  - Email:   ${email}`);
            console.log(`  - Phone:   ${phone || 'None'}`);
            console.log(`  - Subject: ${subject || 'None'}`);
            console.log(`  - Message: "${message}"`);
            console.log('-------------------------------------\n');
        }

        res.status(200).json({ 
            success: true, 
            message: 'Your message has been sent successfully! Our team will get back to you shortly.' 
        });
    } catch (err) {
        console.error('Contact Form processing crash:', err);
        res.status(500).json({ 
            success: false, 
            error: 'An internal server error occurred while processing your request. Please try again later.' 
        });
    }
});

module.exports = router;
