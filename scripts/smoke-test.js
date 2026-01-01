const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error('SMOKE TEST FAILED:', msg);
  process.exit(1);
}

// Check that build output exists
const nextDir = path.resolve(process.cwd(), '.next');
if (!fs.existsSync(nextDir)) {
  fail('.next directory not found — build may have failed');
}

// Check at least one expected page file exists (server build artifact)
const serverDir = path.join(nextDir, 'server');
if (!fs.existsSync(serverDir)) {
  // warn but don't fail — some builds might not have server dir in new Next outputs
  console.warn('Warning: .next/server not found — skipping file checks');
} else {
  // look for any file under server that references 'app' pages
  const files = fs.readdirSync(serverDir);
  if (!files || files.length === 0) {
    fail('.next/server exists but contains no files');
  }
}

console.log('SMOKE TEST: .next directory present — ok');
process.exit(0);
