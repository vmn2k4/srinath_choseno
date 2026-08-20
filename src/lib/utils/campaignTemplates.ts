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
            padding: 0;
            width: 100%;
            -webkit-text-size-adjust: 100%;
        }
        .container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            background-color: #ffffff;
            padding: 16px 20px;
            box-sizing: border-box;
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
            margin: 16px 0;
            width: 100%;
            display: block;
        }
        .way-box {
            display: block !important;
            width: 100% !important;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px 16px;
            margin: 0 0 12px 0;
            background-color: #fafbfc;
            box-sizing: border-box;
            clear: both;
        }
        .way-box:last-child {
            margin-bottom: 0;
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

        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">This is Murugappan Valliyappan, founder of Choseno. I would like to introduce our new product — a dedicated social network for politics.</p>

        <div class="highlight">
            <p class="highlight-title">Your wall is now live</p>
            <p>Voters will see your leadership record, vision, and endorsements — all in one space:</p>
            <p style="margin: 12px 0 0 0;"><strong><a href="https://www.choseno.com/wall/{{wall_slug}}" class="cta-link">View Your Wall</a></strong></p>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #555;">You can quickly try our easiest way to find the polling district you belong to and see how an election wall appears once candidates are nominated: <strong><a href="https://www.choseno.com/find-my-district" class="cta-link">Find my district</a></strong> or <strong><a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Election wall</a></strong></p>
        </div>

        <!-- Video Demo Section with Homepage Card Design -->
        <div class="section" style="margin: 28px 0;">
            <p class="section-title">See Choseno in Action (2-Min Demo)</p>
            <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04); overflow: hidden; max-width: 560px; margin: 0 auto;">
                <a href="https://www.youtube.com/watch?v=WJIpU9Cyoho" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; position: relative; padding: 42px 20px 38px 20px; text-align: center; background: radial-gradient(ellipse at 85% 20%, #f0f7ff 0%, #f8fafc 40%, #ffffff 80%);" title="Click to watch Choseno complete product demo">
                    <!-- Brand Pill -->
                    <div style="display: inline-block; padding: 5px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
                        <span style="display: inline-block; width: 18px; height: 18px; background: #0284c7; color: #ffffff; font-weight: 900; font-size: 11px; line-height: 18px; text-align: center; border-radius: 5px; margin-right: 6px; vertical-align: middle;">C</span>
                        <span style="font-size: 13px; font-weight: 700; color: #0f172a; vertical-align: middle; letter-spacing: 0.2px;">Choseno</span>
                    </div>

                    <!-- Play Disc -->
                    <div style="margin: 0 auto 20px auto; width: 72px; height: 72px; background: #0284c7; border-radius: 50%; box-shadow: 0 8px 24px -4px rgba(2, 132, 199, 0.4), 0 0 0 10px rgba(2, 132, 199, 0.12); text-align: center; line-height: 72px;">
                        <span style="color: #ffffff; font-size: 26px; display: inline-block; margin-left: 5px; vertical-align: middle;">▶</span>
                    </div>

                    <!-- Card Title & Subtitle -->
                    <div style="color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Complete Product Demo
                    </div>
                    <div style="color: #64748b; font-size: 13.5px; font-weight: 500; max-width: 360px; margin: 0 auto; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Watch our full demo to see all Choseno features in action
                    </div>
                </a>
            </div>
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
                <li>Connect directly with voters</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">How to Get Started</p>
            <div class="ways-grid" style="display: block; width: 100%; margin: 16px 0;">
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Quickest (30 seconds)</p>
                    <p class="way-desc">Reply with your preferred email. We'll confirm your identity and activate your wall — then you can own it, post your campaign platform, share promises, and pin your key announcements.</p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Live Demo (15 minutes)</p>
                    <p class="way-desc">Schedule a quick call to see the platform in action. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
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
            padding: 0;
            width: 100%;
            -webkit-text-size-adjust: 100%;
        }
        .container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            background-color: #ffffff;
            padding: 16px 20px;
            box-sizing: border-box;
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
            margin: 16px 0;
            width: 100%;
            display: block;
        }
        .way-box {
            display: block !important;
            width: 100% !important;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px 16px;
            margin: 0 0 12px 0;
            background-color: #fafbfc;
            box-sizing: border-box;
            clear: both;
        }
        .way-box:last-child {
            margin-bottom: 0;
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

        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">This is Murugappan Valliyappan, founder of Choseno. I would like to introduce our new product — a dedicated social network for politics.</p>

        <div class="highlight">
            <p class="highlight-title">Your wall is now live</p>
            <p>Constituents will see your voting record, policy positions, and community testimonials — all in one space:</p>
            <p style="margin: 12px 0 0 0;"><strong><a href="https://www.choseno.com/wall/{{wall_slug}}" class="cta-link">View Your Wall</a></strong></p>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #555;">You can quickly try our easiest way to find the polling district you belong to and see how an election wall appears once candidates are nominated: <strong><a href="https://www.choseno.com/find-my-district" class="cta-link">Find my district</a></strong> or <strong><a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Election wall</a></strong></p>
        </div>

        <!-- Video Demo Section with Homepage Card Design -->
        <div class="section" style="margin: 28px 0;">
            <p class="section-title">See Choseno in Action (2-Min Demo)</p>
            <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04); overflow: hidden; max-width: 560px; margin: 0 auto;">
                <a href="https://www.youtube.com/watch?v=WJIpU9Cyoho" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; position: relative; padding: 42px 20px 38px 20px; text-align: center; background: radial-gradient(ellipse at 85% 20%, #f0f7ff 0%, #f8fafc 40%, #ffffff 80%);" title="Click to watch Choseno complete product demo">
                    <!-- Brand Pill -->
                    <div style="display: inline-block; padding: 5px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
                        <span style="display: inline-block; width: 18px; height: 18px; background: #0284c7; color: #ffffff; font-weight: 900; font-size: 11px; line-height: 18px; text-align: center; border-radius: 5px; margin-right: 6px; vertical-align: middle;">C</span>
                        <span style="font-size: 13px; font-weight: 700; color: #0f172a; vertical-align: middle; letter-spacing: 0.2px;">Choseno</span>
                    </div>

                    <!-- Play Disc -->
                    <div style="margin: 0 auto 20px auto; width: 72px; height: 72px; background: #0284c7; border-radius: 50%; box-shadow: 0 8px 24px -4px rgba(2, 132, 199, 0.4), 0 0 0 10px rgba(2, 132, 199, 0.12); text-align: center; line-height: 72px;">
                        <span style="color: #ffffff; font-size: 26px; display: inline-block; margin-left: 5px; vertical-align: middle;">▶</span>
                    </div>

                    <!-- Card Title & Subtitle -->
                    <div style="color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Complete Product Demo
                    </div>
                    <div style="color: #64748b; font-size: 13.5px; font-weight: 500; max-width: 360px; margin: 0 auto; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Watch our full demo to see all Choseno features in action
                    </div>
                </a>
            </div>
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
                <li>Connect directly with voters</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">How to Get Started</p>
            <div class="ways-grid" style="display: block; width: 100%; margin: 16px 0;">
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Quickest (30 seconds)</p>
                    <p class="way-desc">Reply with your preferred email. We'll confirm your identity and activate your wall — then you can own it, post your campaign platform, share promises, and pin your key announcements.</p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Live Demo (15 minutes)</p>
                    <p class="way-desc">Schedule a quick call to see the platform in action. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
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

const PARTY_BODY = `<!DOCTYPE html>
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
            padding: 0;
            width: 100%;
            -webkit-text-size-adjust: 100%;
        }
        .container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            background-color: #ffffff;
            padding: 16px 20px;
            box-sizing: border-box;
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
            margin: 16px 0;
            width: 100%;
            display: block;
        }
        .way-box {
            display: block !important;
            width: 100% !important;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px 16px;
            margin: 0 0 12px 0;
            background-color: #fafbfc;
            box-sizing: border-box;
            clear: both;
        }
        .way-box:last-child {
            margin-bottom: 0;
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
            <h1>Candidate & Party Outreach on Choseno</h1>
            <p class="intro">Empowering your candidates for the 2026 municipal election cycle</p>
        </div>

        <p style="font-size: 15px; margin: 0 0 24px 0;">Hi {{name}} Team,</p>

        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">This is Murugappan Valliyappan, founder of Choseno. I would like to introduce our new product — a dedicated social network for politics.</p>

        <div class="highlight">
            <p class="highlight-title">100% Free Civic Platform — We Work With Your Candidates</p>
            <p>Choseno provides dedicated Candidate and Election walls so voters in {{city}} can research your platform, compare nominees, and connect directly with your slate. <strong>This is a 100% free service for all parties and candidates — we do not charge for candidate onboarding or strategy meetings.</strong></p>
            <p style="margin: 12px 0 0 0; font-size: 13px;">
                Explore how the platform looks in action:
                <br>• <strong><a href="https://www.choseno.com/find-my-district" class="cta-link">Find your municipal district / polling area</a></strong>
                <br>• <strong><a href="https://www.choseno.com/wall/brenda-locke-mayor" class="cta-link">Sample Candidate Wall</a></strong>
                <br>• <strong><a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Live Election Wall</a></strong>
            </p>
        </div>

        <!-- Video Demo Section with Homepage Card Design -->
        <div class="section" style="margin: 28px 0;">
            <p class="section-title">See Choseno in Action (2-Min Demo)</p>
            <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04); overflow: hidden; max-width: 560px; margin: 0 auto;">
                <a href="https://www.youtube.com/watch?v=WJIpU9Cyoho" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; position: relative; padding: 42px 20px 38px 20px; text-align: center; background: radial-gradient(ellipse at 85% 20%, #f0f7ff 0%, #f8fafc 40%, #ffffff 80%);" title="Click to watch Choseno complete product demo">
                    <!-- Brand Pill -->
                    <div style="display: inline-block; padding: 5px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
                        <span style="display: inline-block; width: 18px; height: 18px; background: #0284c7; color: #ffffff; font-weight: 900; font-size: 11px; line-height: 18px; text-align: center; border-radius: 5px; margin-right: 6px; vertical-align: middle;">C</span>
                        <span style="font-size: 13px; font-weight: 700; color: #0f172a; vertical-align: middle; letter-spacing: 0.2px;">Choseno</span>
                    </div>

                    <!-- Play Disc -->
                    <div style="margin: 0 auto 20px auto; width: 72px; height: 72px; background: #0284c7; border-radius: 50%; box-shadow: 0 8px 24px -4px rgba(2, 132, 199, 0.4), 0 0 0 10px rgba(2, 132, 199, 0.12); text-align: center; line-height: 72px;">
                        <span style="color: #ffffff; font-size: 26px; display: inline-block; margin-left: 5px; vertical-align: middle;">▶</span>
                    </div>

                    <!-- Card Title & Subtitle -->
                    <div style="color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Complete Product Demo
                    </div>
                    <div style="color: #64748b; font-size: 13.5px; font-weight: 500; max-width: 360px; margin: 0 auto; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Watch our full demo to see all Choseno features in action
                    </div>
                </a>
            </div>
        </div>

        <div class="section">
            <p class="section-content">
                Choseno is Canada's social network for politics. It gives local voters a simple way to find their district, see who represents them at every level, and compare candidates side-by-side. We are actively working with parties and candidates across {{city}} to ensure all candidates get equal visibility during the 2026 election cycle.
            </p>
            <p class="section-content">
                <strong>Why onboarding early matters:</strong> Early candidates gain immediate visibility when residents search their districts. Your candidates can start establishing their policy positions, sharing announcements, and gathering voter endorsements now.
            </p>
        </div>

        <div class="section">
            <p class="section-title">How Choseno Supports Your Slate</p>
            <ul class="features">
                <li><strong>Dedicated Candidate Walls:</strong> Individual profile walls for every candidate running on your slate.</li>
                <li><strong>Election Race Hub:</strong> Side-by-side comparison with all competing candidates in their district.</li>
                <li><strong>Direct Voter Engagement:</strong> Constituents can post endorsements, questions, and view verified platform promises.</li>
                <li><strong>100% Free Civic Tech:</strong> No paid paywalls, no ads, and zero charge for meetings or profile verification.</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">How We Can Work Together</p>
            <div class="ways-grid" style="display: block; width: 100%; margin: 16px 0;">
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Onboard Candidate Slate (Quickest)</p>
                    <p class="way-desc">Send us your list of declared candidates. We will verify their profiles and send direct activation links so each candidate can immediately manage their wall.</p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Virtual Meeting / Live Demo (15–30 mins - Free)</p>
                    <p class="way-desc">Schedule a quick call with your campaign team to see how the district lookup and candidate comparison tools work. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">In-Person Discussion</p>
                    <p class="way-desc">Let me know if you would like to meet in person in {{city}} or across the Lower Mainland to discuss how Choseno can assist your campaign communication.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <p class="section-title">Why I Built This</p>
            <p class="section-content">
                After 10+ years building core software at Snapchat, Qualcomm, and AMD, I moved to BC to build a life and start my own company. Choseno was born to strengthen local democracy by helping voters see and evaluate the actual individuals running, making informed choice accessible to all.
            </p>
        </div>

        <div class="signature">
            <p style="margin: 0 0 16px 0;"><span class="founder-name">Murugappan Valliyappan</span><br>Founder, Choseno<br>Lower Mainland, BC</p>
            <div class="contact-links">
                672-355-2636 | <a href="mailto:vijay@choseno.com">vijay@choseno.com</a><br>
                <a href="https://www.linkedin.com/in/muruvalliyappan/">LinkedIn</a> | <a href="https://www.choseno.com">choseno.com</a>
            </div>
        </div>
    </div>
</body>
</html>`;

const CANDIDATE_BODY = `<!DOCTYPE html>
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
            padding: 0;
            width: 100%;
            -webkit-text-size-adjust: 100%;
        }
        .container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            background-color: #ffffff;
            padding: 16px 20px;
            box-sizing: border-box;
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
            margin: 16px 0;
            width: 100%;
            display: block;
        }
        .way-box {
            display: block !important;
            width: 100% !important;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px 16px;
            margin: 0 0 12px 0;
            background-color: #fafbfc;
            box-sizing: border-box;
            clear: both;
        }
        .way-box:last-child {
            margin-bottom: 0;
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
            <h1>Congratulations on Your Nomination in {{city}}!</h1>
            <p class="intro">Claim your official Candidate Wall on Choseno for the 2026 election</p>
        </div>

        <p style="font-size: 15px; margin: 0 0 24px 0;">Hi {{name}},</p>

        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">This is Murugappan Valliyappan, founder of Choseno. I would like to introduce our new product — a dedicated social network for politics.</p>

        <div class="highlight">
            <p class="highlight-title">Your 2026 Campaign Wall on Choseno — 100% Free Service</p>
            <p>We saw that you've stepped up to run for <strong>{{role}}</strong> in {{city}}! To help you connect with voters from day one, your official Candidate Wall is ready to claim. <strong>Choseno is 100% free for all candidates — we never charge for onboarding, wall features, or campaign support calls.</strong></p>
            <p style="margin: 12px 0 0 0; font-size: 13px;">
                See how local voters discover and compare candidates:
                <br>• <strong><a href="https://www.choseno.com/find-my-district" class="cta-link">Find your municipal district / polling area</a></strong>
                <br>• <strong><a href="https://www.choseno.com/wall/brenda-locke-mayor" class="cta-link">Sample Candidate Wall</a></strong>
                <br>• <strong><a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Live Election Wall</a></strong>
            </p>
        </div>

        <!-- Video Demo Section with Homepage Card Design -->
        <div class="section" style="margin: 28px 0;">
            <p class="section-title">See Choseno in Action (2-Min Demo)</p>
            <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04); overflow: hidden; max-width: 560px; margin: 0 auto;">
                <a href="https://www.youtube.com/watch?v=WJIpU9Cyoho" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; position: relative; padding: 42px 20px 38px 20px; text-align: center; background: radial-gradient(ellipse at 85% 20%, #f0f7ff 0%, #f8fafc 40%, #ffffff 80%);" title="Click to watch Choseno complete product demo">
                    <!-- Brand Pill -->
                    <div style="display: inline-block; padding: 5px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
                        <span style="display: inline-block; width: 18px; height: 18px; background: #0284c7; color: #ffffff; font-weight: 900; font-size: 11px; line-height: 18px; text-align: center; border-radius: 5px; margin-right: 6px; vertical-align: middle;">C</span>
                        <span style="font-size: 13px; font-weight: 700; color: #0f172a; vertical-align: middle; letter-spacing: 0.2px;">Choseno</span>
                    </div>

                    <!-- Play Disc -->
                    <div style="margin: 0 auto 20px auto; width: 72px; height: 72px; background: #0284c7; border-radius: 50%; box-shadow: 0 8px 24px -4px rgba(2, 132, 199, 0.4), 0 0 0 10px rgba(2, 132, 199, 0.12); text-align: center; line-height: 72px;">
                        <span style="color: #ffffff; font-size: 26px; display: inline-block; margin-left: 5px; vertical-align: middle;">▶</span>
                    </div>

                    <!-- Card Title & Subtitle -->
                    <div style="color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Complete Product Demo
                    </div>
                    <div style="color: #64748b; font-size: 13.5px; font-weight: 500; max-width: 360px; margin: 0 auto; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Watch our full demo to see all Choseno features in action
                    </div>
                </a>
            </div>
        </div>

        <div class="section">
            <p class="section-content">
                Choseno is Canada's social network for politics. It gives local voters a simple way to find their district, see who represents them at every level, and compare candidates side-by-side. We're launching for the 2026 municipal election cycle.
            </p>
            <p class="section-content">
                <strong>Why establishing your wall early gives you an edge:</strong> When residents search their district to see who is running, early candidates gain immediate visibility. You can start sharing your vision, posting promises, and gathering voter endorsements before the campaign season gets crowded.
            </p>
        </div>

        <div class="section">
            <p class="section-title">What You Can Do on Your Candidate Wall</p>
            <ul class="features">
                <li><strong>Publish Your Platform:</strong> Outline key priorities and policy positions for {{city}}.</li>
                <li><strong>Log Platform Promises:</strong> Let voters see what you stand for with tracked promises.</li>
                <li><strong>Collect Endorsements:</strong> Allow constituents and community leaders to post testimonials on your wall.</li>
                <li><strong>Direct Voter Q&A:</strong> Answer questions directly from local residents in your district.</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">How to Get Started</p>
            <div class="ways-grid" style="display: block; width: 100%; margin: 16px 0;">
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Quick Claim (30 seconds)</p>
                    <p class="way-desc">Reply to this email confirming your nomination. We'll instantly activate your account and link you as the verified owner of your candidate wall.</p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Virtual Meeting / Walkthrough (15–30 mins - Free)</p>
                    <p class="way-desc">Schedule a quick call with me to see how the candidate tools work and how to maximize your district reach. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">In-Person Discussion</p>
                    <p class="way-desc">Let me know if you would like to meet in person in {{city}} or across the Lower Mainland to discuss strategy and platform setup.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <p class="section-title">Why I Built This</p>
            <p class="section-content">
                After 10+ years building core software at Snapchat, Qualcomm, and AMD, I moved to BC to build a life and start my own company. Choseno was built to level the playing field for dedicated local candidates by helping voters discover and evaluate the actual person running, not just party machinery.
            </p>
        </div>

        <div class="signature">
            <p style="margin: 0 0 16px 0;"><span class="founder-name">Murugappan Valliyappan</span><br>Founder, Choseno<br>Lower Mainland, BC</p>
            <div class="contact-links">
                672-355-2636 | <a href="mailto:vijay@choseno.com">vijay@choseno.com</a><br>
                <a href="https://www.linkedin.com/in/muruvalliyappan/">LinkedIn</a> | <a href="https://www.choseno.com">choseno.com</a>
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
            padding: 0;
            width: 100%;
            -webkit-text-size-adjust: 100%;
        }
        .container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            background-color: #ffffff;
            padding: 16px 20px;
            box-sizing: border-box;
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
            margin: 16px 0;
            width: 100%;
            display: block;
        }
        .way-box {
            display: block !important;
            width: 100% !important;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px 16px;
            margin: 0 0 12px 0;
            background-color: #fafbfc;
            box-sizing: border-box;
            clear: both;
        }
        .way-box:last-child {
            margin-bottom: 0;
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

        <p style="font-size: 15px; margin: 0 0 24px 0;">Hi {{name}},</p>

        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">This is Murugappan Valliyappan, founder of Choseno. I would like to introduce our new product — a dedicated social network for politics.</p>

        <div class="highlight">
            <p class="highlight-title">Inaugural Opportunity for Students</p>
            <p>Choseno is launching for the 2026 municipal election cycle, and we're recruiting the first cohort of Election Researchers. This is a hands-on opportunity to apply political theory to real-world civic engagement.</p>
            <p style="margin: 12px 0 0 0;"><strong><a href="https://www.choseno.com/find-my-district" class="cta-link">Find my district</a></strong> or <strong><a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Election wall</a></strong></p>
        </div>

        <!-- Video Demo Section with Homepage Card Design -->
        <div class="section" style="margin: 28px 0;">
            <p class="section-title">See Choseno in Action (2-Min Demo)</p>
            <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04); overflow: hidden; max-width: 560px; margin: 0 auto;">
                <a href="https://www.youtube.com/watch?v=WJIpU9Cyoho" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; position: relative; padding: 42px 20px 38px 20px; text-align: center; background: radial-gradient(ellipse at 85% 20%, #f0f7ff 0%, #f8fafc 40%, #ffffff 80%);" title="Click to watch Choseno complete product demo">
                    <!-- Brand Pill -->
                    <div style="display: inline-block; padding: 5px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
                        <span style="display: inline-block; width: 18px; height: 18px; background: #0284c7; color: #ffffff; font-weight: 900; font-size: 11px; line-height: 18px; text-align: center; border-radius: 5px; margin-right: 6px; vertical-align: middle;">C</span>
                        <span style="font-size: 13px; font-weight: 700; color: #0f172a; vertical-align: middle; letter-spacing: 0.2px;">Choseno</span>
                    </div>

                    <!-- Play Disc -->
                    <div style="margin: 0 auto 20px auto; width: 72px; height: 72px; background: #0284c7; border-radius: 50%; box-shadow: 0 8px 24px -4px rgba(2, 132, 199, 0.4), 0 0 0 10px rgba(2, 132, 199, 0.12); text-align: center; line-height: 72px;">
                        <span style="color: #ffffff; font-size: 26px; display: inline-block; margin-left: 5px; vertical-align: middle;">▶</span>
                    </div>

                    <!-- Card Title & Subtitle -->
                    <div style="color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Complete Product Demo
                    </div>
                    <div style="color: #64748b; font-size: 13.5px; font-weight: 500; max-width: 360px; margin: 0 auto; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Watch our full demo to see all Choseno features in action
                    </div>
                </a>
            </div>
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
                <li>Inaugural Cohort: Be featured on our website as part of the first cohort launching Choseno</li>
                <li>Volunteer Role: 5 hours/week for 8 weeks, fully remote with structured interviews</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">How to Get Involved</p>
            <div class="ways-grid" style="display: block; width: 100%; margin: 16px 0;">
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Quick Google Meet (15-30 minutes)</p>
                    <p class="way-desc">Schedule a call to discuss how we can coordinate with your members. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Information Session</p>
                    <p class="way-desc">If you have an upcoming general meeting, I'd be happy to drop by or join remotely via Google Meet to give a live demo to the team.</p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Direct Student Outreach</p>
                    <p class="way-desc">Interested students can reach out to me directly at vijay@choseno.com with their background and research interests.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <p class="section-content">
                <strong>The Election Researcher Role:</strong> This is a volunteer position where you'll conduct structured interviews with local candidates running in the 2026 municipal elections. Your research helps constituents make informed decisions.
            </p>
            <p class="section-content" style="font-size: 13px; color: #666;">
                <strong>Commitment:</strong> 5 hours per week for 8 weeks (fully remote)
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
            padding: 0;
            width: 100%;
            -webkit-text-size-adjust: 100%;
        }
        .container {
            width: 100%;
            max-width: 100%;
            margin: 0;
            background-color: #ffffff;
            padding: 16px 20px;
            box-sizing: border-box;
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
            margin: 16px 0;
            width: 100%;
            display: block;
        }
        .way-box {
            display: block !important;
            width: 100% !important;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 14px 16px;
            margin: 0 0 12px 0;
            background-color: #fafbfc;
            box-sizing: border-box;
            clear: both;
        }
        .way-box:last-child {
            margin-bottom: 0;
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

        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">This is Murugappan Valliyappan, founder of Choseno. I would like to introduce our new product — a dedicated social network for politics.</p>

        <div class="highlight">
            <p class="highlight-title">Specific Ask: 10 Student Researchers for 2026 Municipal Elections</p>
            <p>Choseno is live and recruiting students to conduct structured interviews with candidates running in the 2026 municipal elections. I'd like to invite 10 students from your program to participate in this hands-on research project — and explore how the data collected can benefit your research agenda.</p>
            <p style="margin: 12px 0 0 0;"><strong><a href="https://www.choseno.com/find-my-district" class="cta-link">Find my district</a></strong> or <strong><a href="https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433" class="cta-link">Sample Election wall</a></strong></p>
        </div>

        <!-- Video Demo Section with Homepage Card Design -->
        <div class="section" style="margin: 28px 0;">
            <p class="section-title">See Choseno in Action (2-Min Demo)</p>
            <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04); overflow: hidden; max-width: 560px; margin: 0 auto;">
                <a href="https://www.youtube.com/watch?v=WJIpU9Cyoho" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; position: relative; padding: 42px 20px 38px 20px; text-align: center; background: radial-gradient(ellipse at 85% 20%, #f0f7ff 0%, #f8fafc 40%, #ffffff 80%);" title="Click to watch Choseno complete product demo">
                    <!-- Brand Pill -->
                    <div style="display: inline-block; padding: 5px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 9999px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
                        <span style="display: inline-block; width: 18px; height: 18px; background: #0284c7; color: #ffffff; font-weight: 900; font-size: 11px; line-height: 18px; text-align: center; border-radius: 5px; margin-right: 6px; vertical-align: middle;">C</span>
                        <span style="font-size: 13px; font-weight: 700; color: #0f172a; vertical-align: middle; letter-spacing: 0.2px;">Choseno</span>
                    </div>

                    <!-- Play Disc -->
                    <div style="margin: 0 auto 20px auto; width: 72px; height: 72px; background: #0284c7; border-radius: 50%; box-shadow: 0 8px 24px -4px rgba(2, 132, 199, 0.4), 0 0 0 10px rgba(2, 132, 199, 0.12); text-align: center; line-height: 72px;">
                        <span style="color: #ffffff; font-size: 26px; display: inline-block; margin-left: 5px; vertical-align: middle;">▶</span>
                    </div>

                    <!-- Card Title & Subtitle -->
                    <div style="color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Complete Product Demo
                    </div>
                    <div style="color: #64748b; font-size: 13.5px; font-weight: 500; max-width: 360px; margin: 0 auto; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        Watch our full demo to see all Choseno features in action
                    </div>
                </a>
            </div>
        </div>

        <div class="section">
            <p class="section-content">
                Choseno is Canada's social network for politics — think of it as business reviews, but for politicians. Just like people research restaurants before dining, voters deserve to research candidates before elections. It gives voters a simple way to find their district, see who represents them at every level, and compare candidates side-by-side.
            </p>
            <p class="section-content">
                We're already live for the 2026 municipal election cycle. After speaking with political science majors who were excited about the platform, I wanted to reach out directly to faculty like yourself to recruit students who can start conducting candidate interviews immediately.
            </p>
        </div>

        <div class="section">
            <p class="section-title">What Students Will Do (5 hours/week for 8 weeks)</p>
            <p class="section-content">
                Students will conduct structured interviews with local candidates running in the 2026 municipal elections. This is hands-on research that directly informs voter decision-making.
            </p>
            <ul class="features">
                <li>Structured Interviews: Conduct 4-6 candidate interviews over 8 weeks (fully remote)</li>
                <li>Direct Networking: Build professional relationships with municipal candidates</li>
                <li>Website Recognition: Be featured as part of our inaugural Election Researcher cohort</li>
                <li>Real-World Application: Apply political theory to actual election research</li>
                <li>Volunteer Role: This is an unpaid volunteer position — 5 hours/week for 8 weeks, fully remote</li>
            </ul>
        </div>

        <div class="section">
            <p class="section-title">How to Proceed</p>
            <div class="ways-grid" style="display: block; width: 100%; margin: 16px 0;">
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Quick Google Meet (15-30 minutes)</p>
                    <p class="way-desc">Schedule a call to discuss recruitment, data access, and how this benefits your research. <a href="https://calendly.com/vmn2k4/30min" class="cta-link">Pick a time</a></p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0 0 12px 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Classroom Introduction</p>
                    <p class="way-desc">I'll join your class or seminar to pitch the program directly to students and answer questions.</p>
                </div>
                <div class="way-box" style="display: block; width: 100%; margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; background-color: #fafbfc; box-sizing: border-box; clear: both;">
                    <p class="way-title">Student Recruitment</p>
                    <p class="way-desc">Forward this to interested students, or I can provide a formal program description to share. Students apply directly at vijay@choseno.com.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <p class="section-title">Why I Built This</p>
            <p class="section-content">
                After 10+ years building core software at Snapchat, Qualcomm, and AMD, I moved to BC to build a life and start my own company. As a new Canadian citizen, I realized I couldn't easily find out who was participating in local elections or what they actually stood for — a challenge I faced as an immigrant in India too.
            </p>
            <p class="section-content">
                Most people choose based on party affiliation, not the actual person representing them. My hope is that Choseno helps voters see the candidate, not just the party. True democracy means informed choice at the individual level. That's what this research project enables — authentic candidate data directly from student researchers.
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

export interface CampaignTemplatePreset {
  key: string;
  label: string;
  badge?: string;
  icon?: string;
  subject: string;
  body: string;
  requiredFields: string[];
  optionalFields: string[];
  csvHeader: string;
  sampleData: string;
  defaultCampaignName: string;
  description: string;
  sampleRecipient: {
    name: string;
    email: string;
    role: string;
    city?: string;
    wallSlug: string;
  };
}

export const CAMPAIGN_TEMPLATE_PRESETS: CampaignTemplatePreset[] = [
  {
    key: "candidate",
    label: "New Candidate Nominees",
    badge: "New Candidate",
    icon: "🌟",
    subject: "Congratulations on Your {{role}} Nomination in {{city}} — Your Campaign Wall is Ready",
    body: CANDIDATE_BODY,
    requiredFields: ["name", "email", "role", "city"],
    optionalFields: ["wall_slug"],
    csvHeader: "name,email,role,city,wall_slug",
    sampleData: "name,email,role,city,wall_slug\nSimran Sandhu,simran@surreycandidate.ca,Councillor,Surrey,simran-sandhu-councillor\nAlex Chen,alex@vancouverforward.ca,Mayor,Vancouver,alex-chen-mayor",
    defaultCampaignName: "2026 Candidate Nominees Outreach",
    description: "Connects with new candidate nominees running for Mayor or Councillor to onboard and claim their Candidate Wall for free.",
    sampleRecipient: {
      name: "Simran Sandhu",
      email: "simran@surreycandidate.ca",
      role: "Councillor",
      city: "Surrey",
      wallSlug: "simran-sandhu-councillor",
    },
  },
  {
    key: "parties",
    label: "Civic Parties",
    badge: "Party Slate",
    icon: "🤝",
    subject: "Candidate & Slate Outreach on Choseno — Free Civic Platform for {{city}} Elections",
    body: PARTY_BODY,
    requiredFields: ["name", "email", "city"],
    optionalFields: ["role", "wall_slug"],
    csvHeader: "name,email,city,role,wall_slug",
    sampleData: "name,email,city,role,wall_slug\nABC Vancouver,info@abcvancouver.ca,Vancouver,Party Executive,abcvancouver\nSurrey Connect,info@surreyconnect.ca,Surrey,Party Executive,surreyconnect",
    defaultCampaignName: "BC Civic Parties 2026",
    description: "Connects with political and civic party executives to onboard candidate slates and share campaign platforms for free.",
    sampleRecipient: {
      name: "ABC Vancouver",
      email: "info@abcvancouver.ca",
      role: "Party Executive",
      city: "Vancouver",
      wallSlug: "abcvancouver",
    },
  },
  {
    key: "mayor",
    label: "Mayor",
    badge: "Candidate Wall",
    icon: "🏛️",
    subject: "Your Mayor Wall is Ready on Choseno — Connect with {{city}} Voters This Election",
    body: MAYOR_BODY,
    requiredFields: ["name", "email", "city", "wall_slug"],
    optionalFields: ["role"],
    csvHeader: "name,email,role,city,wall_slug",
    sampleData: "name,email,role,city,wall_slug\nBrenda Locke,brenda@surrey.ca,Mayor,Surrey,brenda-locke-mayor\nKen Sim,ken@vancouver.ca,Mayor,Vancouver,ken-sim-mayor",
    defaultCampaignName: "BC Mayors 2026",
    description: "Connect with Mayors and candidates to claim their Candidate Wall and engage local voters.",
    sampleRecipient: {
      name: "Brenda Locke",
      email: "brenda@surrey.ca",
      role: "Mayor",
      city: "Surrey",
      wallSlug: "brenda-locke-mayor",
    },
  },
  {
    key: "councillor",
    label: "Councillor",
    badge: "Candidate Wall",
    icon: "🏛️",
    subject: "Your Councillor Wall is Ready on Choseno — Connect with {{city}} Voters This Election",
    body: COUNCILLOR_BODY,
    requiredFields: ["name", "email", "city", "wall_slug"],
    optionalFields: ["role"],
    csvHeader: "name,email,role,city,wall_slug",
    sampleData: "name,email,role,city,wall_slug\nSarah Kirby-Yung,sarah@vancouver.ca,Councillor,Vancouver,sarah-kirby-yung-councillor\nLinda Annis,linda@surrey.ca,Councillor,Surrey,linda-annis-councillor",
    defaultCampaignName: "BC Councillors 2026",
    description: "Invites municipal Councillors to claim their Candidate Wall on Choseno.",
    sampleRecipient: {
      name: "Sarah Kirby-Yung",
      email: "sarah@vancouver.ca",
      role: "Councillor",
      city: "Vancouver",
      wallSlug: "sarah-kirby-yung-councillor",
    },
  },
  {
    key: "pssa",
    label: "Students Association",
    badge: "Researcher Outreach",
    icon: "🎓",
    subject: "Opportunity for Students: Choseno is Recruiting Election Researchers for 2026",
    body: PSSA_BODY,
    requiredFields: ["name", "email"],
    optionalFields: ["role"],
    csvHeader: "name,email,role",
    sampleData: "name,email,role\nUBC Political Science Association,exec@pssa.ubc.ca,Executive Team\nSFU Political Science Union,psu@sfu.ca,Student Union",
    defaultCampaignName: "Student Association Election Researchers 2026",
    description: "Recruits student researchers and partners with Political Science student unions.",
    sampleRecipient: {
      name: "UBC Political Science Association",
      email: "exec@pssa.ubc.ca",
      role: "Executive Team",
      city: "",
      wallSlug: "",
    },
  },
  {
    key: "professor",
    label: "Professor / Academic",
    badge: "Research Collaboration",
    icon: "👨‍🏫",
    subject: "Collaboration Inquiry: Civic Tech & Election Research",
    body: PROFESSOR_BODY,
    requiredFields: ["name", "email", "role"],
    optionalFields: [],
    csvHeader: "name,email,role",
    sampleData: "name,email,role\nDr. Paul Quirk,pquirk@ubc.ca,Professor of Political Science\nDr. Stewart Prest,sprest@sfu.ca,Lecturer in Political Science",
    defaultCampaignName: "Academic Collaboration 2026",
    description: "Inquires about academic collaboration and civic tech research with university faculty.",
    sampleRecipient: {
      name: "Dr. Paul Quirk",
      email: "pquirk@ubc.ca",
      role: "Professor of Political Science",
      city: "",
      wallSlug: "",
    },
  },
];

export const TRACKING_BASE_URL =
  process.env.NEXT_PUBLIC_TRACKING_BASE_URL ||
  `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qlzyfdwrkcxyqapewxwg.supabase.co"}/functions/v1`;

export function addTrackingPixelToTemplate(
  htmlBody: string,
  trackingToken: string
): string {
  const trackingPixelUrl = `${TRACKING_BASE_URL}/track-email-open?token=${encodeURIComponent(trackingToken)}`;
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
  if (htmlBody.includes("</body>")) {
    return htmlBody.replace("</body>", `${trackingPixel}</body>`);
  }
  return `${htmlBody}${trackingPixel}`;
}

export function createTrackedLink(
  originalUrl: string,
  trackingToken: string
): string {
  const encoded = encodeURIComponent(originalUrl);
  return `${TRACKING_BASE_URL}/track-link-click?token=${encodeURIComponent(trackingToken)}&link=${encoded}&redirect=${encoded}`;
}

