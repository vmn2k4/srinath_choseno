// Preset subject/body pairs for the admin Campaign tab (CampaignAdminClient).
//
// This is the exact HTML from email-templates/mayor-professional.html and
// email-templates/councillor-professional.html — copied verbatim, with only
// the bracket placeholders swapped for the merge tags fillCampaignTemplate
// understands ([Name] -> {{name}}, [City] -> {{city}}, [wall_slug] ->
// {{wall_slug}}). Don't restyle or reword these inline; edit the source
// .html files under email-templates/ first, then re-copy here so the two
// never drift apart.

export interface CampaignTemplatePreset {
  key: string;
  label: string;
  subject: string;
  body: string;
}

const MAYOR_BODY = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background-color: #eef1f5;
            margin: 0;
            padding: 32px 16px;
        }
        .container {
            max-width: 680px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 48px;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
        }
        @media (max-width: 700px) {
            body {
                padding: 0;
            }
            .container {
                max-width: 100%;
                border: none;
                border-radius: 0;
                padding: 28px 20px;
            }
        }
        .header {
            margin-bottom: 32px;
        }
        h1 {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: #1a2332;
        }
        .intro {
            font-size: 15px;
            color: #666;
            margin: 0 0 24px 0;
        }
        .highlight {
            background-color: #f0f4ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .highlight-title {
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .highlight p {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .cta-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
        }
        .cta-link:hover {
            text-decoration: underline;
        }
        .section {
            margin: 32px 0;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 16px 0;
        }
        .section-content {
            font-size: 14px;
            line-height: 1.6;
            color: #2c3e50;
        }
        .features {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .features li {
            padding: 8px 0 8px 24px;
            position: relative;
            font-size: 14px;
        }
        .features li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #3b82f6;
            font-weight: bold;
        }
        .ways-grid {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin: 16px 0;
        }
        .way-box {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 16px;
            background-color: #fafbfc;
        }
        .way-title {
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .way-desc {
            font-size: 13px;
            color: #666;
            margin: 0;
        }
        .signature {
            margin-top: 40px;
            padding-top: 32px;
            border-top: 1px solid #e5e7eb;
            font-size: 13px;
            color: #666;
            line-height: 1.8;
        }
        .founder-name {
            font-weight: 600;
            color: #1a2332;
        }
        .contact-links {
            margin-top: 16px;
            font-size: 13px;
        }
        .contact-links a {
            color: #3b82f6;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Your Mayor Wall is Ready</h1>
            <p class="intro">Join Choseno for the 2026 municipal election cycle</p>
        </div>

        <p style="font-size: 15px; margin: 0 0 24px 0;">Hi Mayor {{name}},</p>

        <div class="highlight">
            <p class="highlight-title">Your wall is now live</p>
            <p>Voters will see your leadership record, vision, and endorsements — all in one space:</p>
            <p style="margin: 12px 0 0 0;"><strong><a href="https://www.choseno.com/wall/{{wall_slug}}" class="cta-link">View Your Wall</a></strong></p>
        </div>

        <div class="section">
            <p class="section-content">
                Choseno is Canada's social network for politics. It gives local voters a simple way to find their district, see who represents them at every level, and compare candidates side-by-side. We're launching for the 2026 municipal election cycle.
            </p>
            <p class="section-content">
                <strong>The advantage of joining now:</strong> Early candidates gain visibility when residents search. You can start building momentum while others are still deciding.
            </p>
        </div>

        <div class="section">
            <p class="section-title">What You Can Do</p>
            <ul class="features">
                <li>Highlight your mayoral record and vision for the future</li>
                <li>Let constituents post authentic testimonials</li>
                <li>Connect directly with voters seeking verified information</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">How to Get Started</p>
            <div class="ways-grid">
                <div class="way-box">
                    <p class="way-title">Quickest (30 seconds)</p>
                    <p class="way-desc">Reply to this email with your preferred email, and we'll verify and activate your wall within 24 hours.</p>
                </div>
                <div class="way-box">
                    <p class="way-title">Live Demo (15 minutes)</p>
                    <p class="way-desc">Schedule a quick call to see the platform in action. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box">
                    <p class="way-title">In-Person Meeting</p>
                    <p class="way-desc">Let me know if you'd prefer to meet in Surrey or the Lower Mainland to discuss strategy.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <p class="section-content">
                <strong>Try it out:</strong> <a href="https://www.choseno.com/find-my-district" class="cta-link">Find my district</a> or <a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Election wall</a>
            </p>
        </div>

        <div class="section">
            <p class="section-title">Why I Built This</p>
            <p class="section-content">
                After 10+ years building core software at Snapchat, Qualcomm, and AMD, I moved to BC to build a life and start my own company. Choseno is the result.
            </p>
        </div>

        <div class="signature">
            <p style="margin: 0 0 16px 0;"><span class="founder-name">Murugappan Valliyappan</span><br>Founder, Choseno<br>Lower Mainland, BC</p>
            <div class="contact-links">
                672-355-2636 | <a href="mailto:vijay@choseno.com">vijay@choseno.com</a><br>
                <a href="https://www.linkedin.com/in/muruvalliyappan/">LinkedIn</a>
            </div>
        </div>
    </div>
</body>
</html>`;

const COUNCILLOR_BODY = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background-color: #eef1f5;
            margin: 0;
            padding: 32px 16px;
        }
        .container {
            max-width: 680px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 48px;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
        }
        @media (max-width: 700px) {
            body {
                padding: 0;
            }
            .container {
                max-width: 100%;
                border: none;
                border-radius: 0;
                padding: 28px 20px;
            }
        }
        .header {
            margin-bottom: 32px;
        }
        h1 {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: #1a2332;
        }
        .intro {
            font-size: 15px;
            color: #666;
            margin: 0 0 24px 0;
        }
        .highlight {
            background-color: #f0f4ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .highlight-title {
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .highlight p {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .cta-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
        }
        .cta-link:hover {
            text-decoration: underline;
        }
        .section {
            margin: 32px 0;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 16px 0;
        }
        .section-content {
            font-size: 14px;
            line-height: 1.6;
            color: #2c3e50;
        }
        .features {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .features li {
            padding: 8px 0 8px 24px;
            position: relative;
            font-size: 14px;
        }
        .features li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #3b82f6;
            font-weight: bold;
        }
        .ways-grid {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin: 16px 0;
        }
        .way-box {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 16px;
            background-color: #fafbfc;
        }
        .way-title {
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .way-desc {
            font-size: 13px;
            color: #666;
            margin: 0;
        }
        .signature {
            margin-top: 40px;
            padding-top: 32px;
            border-top: 1px solid #e5e7eb;
            font-size: 13px;
            color: #666;
            line-height: 1.8;
        }
        .founder-name {
            font-weight: 600;
            color: #1a2332;
        }
        .contact-links {
            margin-top: 16px;
            font-size: 13px;
        }
        .contact-links a {
            color: #3b82f6;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Your Councillor Wall is Ready</h1>
            <p class="intro">Join Choseno for the 2026 municipal election cycle</p>
        </div>

        <p style="font-size: 15px; margin: 0 0 24px 0;">Hi Councillor {{name}},</p>

        <div class="highlight">
            <p class="highlight-title">Your wall is now live</p>
            <p>Constituents will see your voting record, policy positions, and community testimonials — all in one space:</p>
            <p style="margin: 12px 0 0 0;"><strong><a href="https://www.choseno.com/wall/{{wall_slug}}" class="cta-link">View Your Wall</a></strong></p>
        </div>

        <div class="section">
            <p class="section-content">
                Choseno is Canada's social network for politics. It gives local voters a simple way to find their district, see who represents them at every level, and compare candidates side-by-side. We're launching for the 2026 municipal election cycle.
            </p>
            <p class="section-content">
                <strong>The advantage of joining now:</strong> Early candidates gain visibility when residents search. You can start building momentum while others are still deciding.
            </p>
        </div>

        <div class="section">
            <p class="section-title">What You Can Do</p>
            <ul class="features">
                <li>Share your voting record and policy positions on council issues</li>
                <li>Let constituents post authentic testimonials about your representation</li>
                <li>Connect directly with voters seeking verified council information</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">How to Get Started</p>
            <div class="ways-grid">
                <div class="way-box">
                    <p class="way-title">Quickest (30 seconds)</p>
                    <p class="way-desc">Reply to this email with your preferred email, and we'll verify and activate your wall within 24 hours.</p>
                </div>
                <div class="way-box">
                    <p class="way-title">Live Demo (15 minutes)</p>
                    <p class="way-desc">Schedule a quick call to see the platform in action. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box">
                    <p class="way-title">In-Person Meeting</p>
                    <p class="way-desc">Let me know if you'd prefer to meet in Surrey or the Lower Mainland to discuss strategy.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <p class="section-content">
                <strong>Try it out:</strong> <a href="https://www.choseno.com/find-my-district" class="cta-link">Find my district</a> or <a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Election wall</a>
            </p>
        </div>

        <div class="section">
            <p class="section-title">Why I Built This</p>
            <p class="section-content">
                After 10+ years building core software at Snapchat, Qualcomm, and AMD, I moved to BC to build a life and start my own company. Choseno is the result.
            </p>
        </div>

        <div class="signature">
            <p style="margin: 0 0 16px 0;"><span class="founder-name">Murugappan Valliyappan</span><br>Founder, Choseno<br>Lower Mainland, BC</p>
            <div class="contact-links">
                672-355-2636 | <a href="mailto:vijay@choseno.com">vijay@choseno.com</a><br>
                <a href="https://www.linkedin.com/in/muruvalliyappan/">LinkedIn</a>
            </div>
        </div>
    </div>
</body>
</html>`;

const PSSA_BODY = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background-color: #eef1f5;
            margin: 0;
            padding: 32px 16px;
        }
        .container {
            max-width: 680px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 48px;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
        }
        @media (max-width: 700px) {
            body {
                padding: 0;
            }
            .container {
                max-width: 100%;
                border: none;
                border-radius: 0;
                padding: 28px 20px;
            }
        }
        .header {
            margin-bottom: 32px;
        }
        h1 {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: #1a2332;
        }
        .intro {
            font-size: 15px;
            color: #666;
            margin: 0 0 24px 0;
        }
        .highlight {
            background-color: #f0f4ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .highlight-title {
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .highlight p {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .cta-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
        }
        .cta-link:hover {
            text-decoration: underline;
        }
        .section {
            margin: 32px 0;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 16px 0;
        }
        .section-content {
            font-size: 14px;
            line-height: 1.6;
            color: #2c3e50;
        }
        .features {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .features li {
            padding: 8px 0 8px 24px;
            position: relative;
            font-size: 14px;
        }
        .features li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #3b82f6;
            font-weight: bold;
        }
        .ways-grid {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin: 16px 0;
        }
        .way-box {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 16px;
            background-color: #fafbfc;
        }
        .way-title {
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .way-desc {
            font-size: 13px;
            color: #666;
            margin: 0;
        }
        .signature {
            margin-top: 40px;
            padding-top: 32px;
            border-top: 1px solid #e5e7eb;
            font-size: 13px;
            color: #666;
            line-height: 1.8;
        }
        .founder-name {
            font-weight: 600;
            color: #1a2332;
        }
        .contact-links {
            margin-top: 16px;
            font-size: 13px;
        }
        .contact-links a {
            color: #3b82f6;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Choseno is Recruiting Election Researchers</h1>
            <p class="intro">Join us for the inaugural cohort launching the 2026 municipal election cycle</p>
        </div>

        <p style="font-size: 15px; margin: 0 0 24px 0;">Hi PSSA Executive Team,</p>

        <div class="highlight">
            <p class="highlight-title">Inaugural Opportunity for Students</p>
            <p>Choseno is launching for the 2026 municipal election cycle, and we're recruiting the first cohort of Election Researchers. This is a hands-on opportunity to apply political theory to real-world civic engagement.</p>
            <p style="margin: 12px 0 0 0;"><strong><a href="https://www.choseno.com/find-my-district" class="cta-link">Find my district</a></strong> or <strong><a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Election wall</a></strong></p>
        </div>

        <div class="section">
            <p class="section-content">
                Choseno is Canada's social network for politics — think of it as business reviews, but for politicians. Just like you research restaurants before dining, voters deserve to research candidates before elections. It gives voters a simple way to find their district, see who represents them at every level, and compare candidates side-by-side. We're launching for the 2026 municipal election cycle.
            </p>
            <p class="section-content">
                After speaking with a few political science majors who were all very excited about the platform, I wanted to reach out directly to your team. Please feel free to forward this to your members so interested students can reach out to me.
            </p>
        </div>

        <div class="section">
            <p class="section-title">Why Join as an Election Researcher?</p>
            <ul class="features">
                <li>Build Connections: Get direct access and networking with local municipal candidates</li>
                <li>Gain Experience: Apply political theory to real-world journalism, civic tech, and campaign strategy</li>
                <li>Inaugural Cohort: Be part of the first batch launching the platform for 2026</li>
                <li>Official Certification: Receive volunteer certification for your CV and portfolios</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">How to Get Involved</p>
            <div class="ways-grid">
                <div class="way-box">
                    <p class="way-title">Quick Google Meet (15-30 minutes)</p>
                    <p class="way-desc">Schedule a call to discuss how we can coordinate with your members. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box">
                    <p class="way-title">Information Session</p>
                    <p class="way-desc">If you have an upcoming general meeting, I'd be happy to drop by or join remotely via Google Meet to give a live demo to the team.</p>
                </div>
                <div class="way-box">
                    <p class="way-title">Direct Student Outreach</p>
                    <p class="way-desc">Interested students can reach out to me directly at vijay@choseno.com with their background and research interests.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <p class="section-content">
                <strong>The Election Researcher Role:</strong> We want students to provide unbiased views and interview candidates who are participating in upcoming municipal elections. Your research helps constituents make informed decisions.
            </p>
        </div>

        <div class="section">
            <p class="section-title">Why I Built This</p>
            <p class="section-content">
                After 10+ years building core software at Snapchat, Qualcomm, and AMD, I moved to BC to build a life and start my own company. Choseno is the result—a bridge between technology and local democracy.
            </p>
        </div>

        <div class="signature">
            <p style="margin: 0 0 16px 0;"><span class="founder-name">Murugappan Valliyappan</span><br>Founder, Choseno<br>Lower Mainland, BC</p>
            <div class="contact-links">
                672-355-2636 | <a href="mailto:vijay@choseno.com">vijay@choseno.com</a><br>
                <a href="https://www.choseno.com">choseno.com</a>
            </div>
        </div>
    </div>
</body>
</html>`;

const PROFESSOR_BODY = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            background-color: #eef1f5;
            margin: 0;
            padding: 32px 16px;
        }
        .container {
            max-width: 680px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 48px;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
        }
        @media (max-width: 700px) {
            body {
                padding: 0;
            }
            .container {
                max-width: 100%;
                border: none;
                border-radius: 0;
                padding: 28px 20px;
            }
        }
        .header {
            margin-bottom: 32px;
        }
        h1 {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: #1a2332;
        }
        .intro {
            font-size: 15px;
            color: #666;
            margin: 0 0 24px 0;
        }
        .highlight {
            background-color: #f0f4ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .highlight-title {
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .highlight p {
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
        }
        .cta-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
        }
        .cta-link:hover {
            text-decoration: underline;
        }
        .section {
            margin: 32px 0;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 16px 0;
        }
        .section-content {
            font-size: 14px;
            line-height: 1.6;
            color: #2c3e50;
        }
        .features {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .features li {
            padding: 8px 0 8px 24px;
            position: relative;
            font-size: 14px;
        }
        .features li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #3b82f6;
            font-weight: bold;
        }
        .ways-grid {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin: 16px 0;
        }
        .way-box {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 16px;
            background-color: #fafbfc;
        }
        .way-title {
            font-weight: 600;
            color: #1a2332;
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .way-desc {
            font-size: 13px;
            color: #666;
            margin: 0;
        }
        .signature {
            margin-top: 40px;
            padding-top: 32px;
            border-top: 1px solid #e5e7eb;
            font-size: 13px;
            color: #666;
            line-height: 1.8;
        }
        .founder-name {
            font-weight: 600;
            color: #1a2332;
        }
        .contact-links {
            margin-top: 16px;
            font-size: 13px;
        }
        .contact-links a {
            color: #3b82f6;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Collaboration Inquiry: Civic Tech & Election Research</h1>
            <p class="intro">Exploring experiential learning for the 2026 municipal election cycle</p>
        </div>

        <p style="font-size: 15px; margin: 0 0 24px 0;">Dear Professor {{name}},</p>

        <div class="highlight">
            <p class="highlight-title">Research and Learning Opportunity</p>
            <p>I'm reaching out to explore collaboration opportunities around Choseno, a non-partisan civic media platform designed to map users to their electoral boundaries and provide verified data on local municipal candidates.</p>
            <p style="margin: 12px 0 0 0;"><strong><a href="https://www.choseno.com/find-my-district" class="cta-link">Find my district</a></strong> or <strong><a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Election wall</a></strong></p>
        </div>

        <div class="section">
            <p class="section-content">
                Choseno is Canada's social network for politics — think of it as business reviews, but for politicians. Just like people research restaurants before dining, voters deserve to research candidates before elections. It gives voters a simple way to find their district, see who represents them at every level, and compare candidates side-by-side. We're launching for the 2026 municipal election cycle.
            </p>
            <p class="section-content">
                After speaking with a few political science majors who were excited about the platform, I wanted to connect with faculty like yourself. Given your focus on [mention their specific field], I believe this could align with student research, civic engagement, or experiential learning initiatives.
            </p>
        </div>

        <div class="section">
            <p class="section-title">Opportunity for Students: Election Researchers</p>
            <p class="section-content">
                We're recruiting an inaugural cohort of Election Researchers. These students will gain hands-on experience by interviewing local candidates, gathering verified policy data, and helping constituents connect with their future leaders.
            </p>
            <ul class="features">
                <li>Practical Fieldwork: Applying political theory to real-world data collection and campaign strategy</li>
                <li>Direct Networking: Establishing professional connections with municipal candidates</li>
                <li>CV Recognition: Official certification of volunteering for portfolios and academic records</li>
                <li>First Cohort: Be part of the inaugural group launching this platform for 2026</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">Next Steps</p>
            <div class="ways-grid">
                <div class="way-box">
                    <p class="way-title">Quick Google Meet (15-30 minutes)</p>
                    <p class="way-desc">Schedule a call to discuss the project and potential collaboration. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box">
                    <p class="way-title">Class or Seminar Demo</p>
                    <p class="way-desc">I'd be happy to join an upcoming class or seminar remotely via Google Meet to give a live demo to your students.</p>
                </div>
                <div class="way-box">
                    <p class="way-title">Student Participation</p>
                    <p class="way-desc">Interested students can reach out directly with their research interests and background at vijay@choseno.com.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <p class="section-content">
                <strong>The Election Researcher Role:</strong> We want students to provide unbiased views and interview candidates who are participating in upcoming municipal elections. This hands-on research helps constituents make informed decisions and gives students real-world fieldwork experience.
            </p>
        </div>

        <div class="section">
            <p class="section-title">Why I Built This</p>
            <p class="section-content">
                After 10+ years building core software at Snapchat, Qualcomm, and AMD, I moved to BC to build a life and start my own company. Choseno is the result—a bridge between technology and local democracy.
            </p>
        </div>

        <div class="signature">
            <p style="margin: 0 0 16px 0;"><span class="founder-name">Murugappan Valliyappan</span><br>Founder, Choseno<br>Lower Mainland, BC</p>
            <div class="contact-links">
                672-355-2636 | <a href="mailto:vijay@choseno.com">vijay@choseno.com</a><br>
                <a href="https://www.choseno.com">choseno.com</a>
            </div>
        </div>
    </div>
</body>
</html>`;

export const CAMPAIGN_TEMPLATE_PRESETS: CampaignTemplatePreset[] = [
  {
    key: "mayor",
    label: "Mayor — Choseno wall",
    subject: "Your Mayor Wall is Ready on Choseno — Connect with {{city}} Voters This Election",
    body: MAYOR_BODY,
  },
  {
    key: "councillor",
    label: "Councillor — Choseno wall",
    subject: "Your Councillor Wall is Ready on Choseno — Connect with {{city}} Voters This Election",
    body: COUNCILLOR_BODY,
  },
  {
    key: "pssa",
    label: "Students Association — Election Researchers",
    subject: "Opportunity for Students: Choseno is Recruiting Election Researchers for 2026",
    body: PSSA_BODY,
  },
  {
    key: "professor",
    label: "Professor — Collaboration & Research",
    subject: "Collaboration Inquiry: Civic Tech & Election Research",
    body: PROFESSOR_BODY,
  },
];
