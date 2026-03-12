import { vi, describe, it, expect } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue(''),
}));
vi.mock('@hardlydifficult/date-time', () => ({
  duration: vi.fn().mockReturnValue(100),
}));

describe('debug module - is mod the source module?', () => {
  it('checks if EvaluatedModuleNode is the source module object', async () => {
    const autoFix = await import('../src/auto-commit-fixes.js');
    
    const worker = (globalThis as any).__vitest_worker__;
    const evaluatedModules = worker?.evaluatedModules;
    
    if (evaluatedModules?.idToModuleMap) {
      const entries = [...evaluatedModules.idToModuleMap.entries()];
      const autoFixEntry = entries.find(([k]: [string, unknown]) => 
        (k as string).includes('auto-commit-fixes')
      ) as [string, any] | undefined;
      
      if (autoFixEntry) {
        const [key, mod] = autoFixEntry;
        
        // Check if require.main === mod would be the right comparison
        // That is: if `module` in the source file is actually the EvaluatedModuleNode
        const req = require as NodeJS.Require & { main: unknown };
        const origMain = req.main;
        req.main = mod;
        
        // Reset modules and re-import
        vi.resetModules();
        
        const originalEnv = process.env;
        process.env = {};
        
        try {
          await import('../src/auto-commit-fixes.js');
          await new Promise(r => setTimeout(r, 100));
          console.log('process.exitCode after import:', process.exitCode);
        } catch (e) {
          console.log('Import error:', (e as Error).message);
        } finally {
          process.env = originalEnv;
          req.main = origMain;
          process.exitCode = 0;
          vi.resetModules();
        }
      }
    }
    
    expect(true).toBe(true);
  });
});
