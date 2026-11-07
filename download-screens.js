import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { StitchToolClient } from '@google/stitch-sdk';

const PROJECT_ID = '6964175987263913822';
const QUOTA_PROJECT = 'kaidive';

async function main() {
  console.log('🔑 Getting access token from gcloud...');
  const envConfig = process.env.CLOUDSDK_CONFIG || 'C:\\Users\\mcbm1\\.stitch-mcp\\config';
  const gcloudBin = 'C:\\Users\\mcbm1\\.stitch-mcp\\google-cloud-sdk\\bin\\gcloud.cmd';

  const token = execSync(`"${gcloudBin}" auth print-access-token`, {
    env: { ...process.env, CLOUDSDK_CONFIG: envConfig },
    encoding: 'utf-8'
  }).trim();

  console.log('🚀 Connecting to Stitch API...');
  const client = new StitchToolClient({
    accessToken: token,
    projectId: QUOTA_PROJECT
  });

  const outputDir = path.resolve('./screens');
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`📋 Fetching screens for project: ${PROJECT_ID}...`);
  const screensRes = await client.callTool('list_screens', { projectId: PROJECT_ID });
  const screens = screensRes?.screens || [];
  console.log(`Found ${screens.length} screens.`);

  const orderedIds = [
    'ba540d54a6c44797906789fac388b035',
    '275f3d3b7486468b8d508017e876da96',
    '52839bde2aa04d96a9dd578a5ab66043',
    '824237f87e29403695efd0250d521484'
  ];

  const sortedScreens = [...screens].sort((a, b) => {
    const idA = a.name.split('/').pop();
    const idB = b.name.split('/').pop();
    const idxA = orderedIds.indexOf(idA);
    const idxB = orderedIds.indexOf(idB);
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  for (let i = 0; i < sortedScreens.length; i++) {
    const screen = sortedScreens[i];
    const screenId = screen.name.split('/').pop();
    const safeTitle = (screen.title || `screen_${i + 1}`).replace(/[/\\?%*:|"<>]/g, '_').trim();
    const folderName = `${i + 1}_${safeTitle}`;
    const screenDir = path.join(outputDir, folderName);
    await fs.mkdir(screenDir, { recursive: true });

    console.log(`\n📥 [${i + 1}/${sortedScreens.length}] ${screen.title} (${screenId})`);

    // 1. Save metadata
    await fs.writeFile(path.join(screenDir, 'metadata.json'), JSON.stringify(screen, null, 2), 'utf-8');

    // 2. Download HTML code
    const htmlUrl = screen.htmlCode?.downloadUrl;
    if (htmlUrl) {
      console.log(`   ⬇️ Downloading HTML code...`);
      const res = await fetch(htmlUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Goog-User-Project': QUOTA_PROJECT
        }
      });
      const html = await res.text();
      await fs.writeFile(path.join(screenDir, 'code.html'), html, 'utf-8');
      console.log(`   ✓ Saved code.html (${html.length} bytes)`);
    }

    // 3. Download Screenshot image
    const screenshotUrl = screen.screenshot?.downloadUrl;
    if (screenshotUrl) {
      console.log(`   ⬇️ Downloading screenshot...`);
      const res = await fetch(screenshotUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Goog-User-Project': QUOTA_PROJECT
        }
      });
      const arrayBuffer = await res.arrayBuffer();
      await fs.writeFile(path.join(screenDir, 'screen.png'), Buffer.from(arrayBuffer));
      console.log(`   ✓ Saved screen.png (${arrayBuffer.byteLength} bytes)`);
    }
  }

  // 4. Download Design System tokens
  console.log('\n🎨 Fetching Design System tokens...');
  try {
    const dsRes = await client.callTool('list_design_systems', { projectId: PROJECT_ID });
    const designSystems = dsRes?.designSystems || [];
    if (designSystems.length > 0) {
      const ds = designSystems[0];
      await fs.writeFile(path.join(outputDir, 'design-tokens.json'), JSON.stringify(ds, null, 2), 'utf-8');

      const designMd = ds?.designSystem?.theme?.designMd;
      if (designMd) {
        await fs.writeFile(path.join(outputDir, 'DESIGN.md'), designMd, 'utf-8');
        console.log('✓ Saved DESIGN.md');
      }
      console.log('✓ Saved design-tokens.json');
    }
  } catch (err) {
    console.warn('⚠️ Design system fetch note:', err.message);
  }

  console.log('\n✨ All screens, code, images, and design system downloaded successfully!');
  await client.close().catch(() => {});
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
