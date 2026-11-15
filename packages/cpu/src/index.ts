// CPUの考え。公開情報と自分の手札だけで決める(ズルをしない)。
export { decide, toAction, type CpuDecision } from './decide';
export { simulateGame, type SimulationOptions, type SimulationResult } from './simulate';
