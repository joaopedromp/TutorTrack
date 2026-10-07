import {afterEach, expect, it, vi} from 'vitest';
import {safetyBackup} from '../src/safetyBackup';

vi.mock('../src/data',()=>({exportData:async()=>({version:1,students:[],sessions:[],settings:{}})}));
afterEach(()=>vi.unstubAllGlobals());
it('stops destructive actions when automatic backups are unavailable or fail',async()=>{
  vi.stubGlobal('window',{});
  await expect(safetyBackup()).rejects.toThrow('unavailable');
  vi.stubGlobal('window',{tutortrack:{safetyBackup:async()=>false}});
  await expect(safetyBackup()).rejects.toThrow('not saved');
  vi.stubGlobal('window',{tutortrack:{safetyBackup:async()=>{throw Error('Disk full');}}});
  await expect(safetyBackup()).rejects.toThrow('Disk full');
});
it('awaits the private backup before allowing the caller to continue',async()=>{
  let saved='';
  vi.stubGlobal('window',{tutortrack:{safetyBackup:async(json:string)=>{saved=json;return true;}}});
  await safetyBackup();
  expect(JSON.parse(saved)).toMatchObject({version:1,students:[],sessions:[]});
});
