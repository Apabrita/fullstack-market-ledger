const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const errImport = 'import { ErrorBoundary } from "./components/ErrorBoundary";\n';
if (!code.includes('ErrorBoundary')) {
  const firstImport = code.indexOf('import React');
  code = code.slice(0, firstImport) + errImport + code.slice(firstImport);
}

// Replace all `<Suspense fallback={<FallbackLoader />}> ... </Suspense>` with `<ErrorBoundary><Suspense ...></ErrorBoundary>`
// They are inside `src/App.tsx` rendering block.
const rx = /<Suspense fallback=\{<FallbackLoader \/>\}>\s*<([A-Za-z]+)([^>]*)\/>\s*<\/Suspense>/g;

code = code.replace(rx, (match, compName, attrs) => {
   return `<ErrorBoundary componentName="${compName}">\n              <Suspense fallback={<FallbackLoader />}>\n                <${compName}${attrs}/>\n              </Suspense>\n            </ErrorBoundary>`;
});

fs.writeFileSync('src/App.tsx', code);
console.log("Success wrapping components in ErrorBoundary");
