import fs from 'node:fs';
import path from 'node:path';

const targetRelPaths = [
  'ClickAwayListener/ClickAwayListener.js',
  'FocusTrap/FocusTrap.js',
  'Portal/Portal.js',
  'Fade/Fade.js',
  'Grow/Grow.js',
  'Slide/Slide.js',
  'Tooltip/Tooltip.js',
  'Zoom/Zoom.js',
];

const variantDirs = ['', 'modern', 'node', 'legacy'];
const packages = ['node_modules/@mui/base', 'node_modules/@mui/material'];

const REPLACEMENT =
  '(parseInt(React.version, 10) >= 19 ? (children && children.props ? children.props.ref : null) : children.ref)';

let patchedCount = 0;

for (const pkg of packages) {
  for (const variant of variantDirs) {
    for (const rel of targetRelPaths) {
      const fullPath = path.resolve(process.cwd(), pkg, variant, rel);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(REPLACEMENT)) continue;
      if (content.includes('children.ref')) {
        const updated = content.replaceAll('children.ref', REPLACEMENT);
        fs.writeFileSync(fullPath, updated, 'utf8');
        patchedCount += 1;
      }
    }
  }
}

// Also patch @mui/material/Tabs/ScrollbarSize.js where React 19 passes `ref: null` in `other` props
// from @emotion/styled onto a plain function component, overwriting `ref: nodeRef`.
for (const variant of variantDirs) {
  const scrollbarPath = path.resolve(
    process.cwd(),
    'node_modules/@mui/material',
    variant,
    'Tabs/ScrollbarSize.js'
  );
  if (!fs.existsSync(scrollbarPath)) continue;
  let content = fs.readFileSync(scrollbarPath, 'utf8');
  let modified = false;

  if (content.includes('const _excluded = ["onChange"];')) {
    content = content.replace(
      'const _excluded = ["onChange"];',
      'const _excluded = ["onChange", "ref"];'
    );
    modified = true;
  }

  if (
    content.includes(
      'scrollbarHeight.current = nodeRef.current.offsetHeight - nodeRef.current.clientHeight;'
    ) &&
    !content.includes('if (!nodeRef.current) return;')
  ) {
    content = content.replace(
      'scrollbarHeight.current = nodeRef.current.offsetHeight - nodeRef.current.clientHeight;',
      'if (!nodeRef.current) return;\n    scrollbarHeight.current = nodeRef.current.offsetHeight - nodeRef.current.clientHeight;'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(scrollbarPath, content, 'utf8');
    patchedCount += 1;
  }
}

console.log(
  `[patch-mui-react19-ref] Patched ${patchedCount} MUI files for React 19 compatibility.`
);
