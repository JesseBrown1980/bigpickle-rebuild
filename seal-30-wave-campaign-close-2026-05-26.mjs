import { durableNotify } from './src/cosign-bridge.mjs';
import { RedisBridge, channelFor } from './src/redis-bridge.mjs';

const r = new RedisBridge({
  host: '127.0.0.1',
  port: 6379,
  vantage: 'acer',
  bearer: 'bc2f652854438b1b0f9f2566a97500561a850713260982c0af6eb77ddd8e0e98',
});
await r.connect();
await r.auth();

const seal = await durableNotify(
  channelFor('acer', '30-wave-campaign', 'close-2026-05-26'),
  {
    event: '30_WAVE_1E200_MAPPING_CAMPAIGN_LOGICAL_CLOSE',
    ts: new Date().toISOString(),
    campaign: '30-wave-mapping-2026-05-26',
    law_anchor: 'LAW-035',
    law_cosign_seq: 3365,
    method: 'LOGICAL_wave_reports_from_PROF_fabric_lenses_NOT_540_real_agent_spawns_to_avoid_real_agent_storm_RG_0.999',
    waves_canonized: 30,
    artifact_paths: {
      law_035: 'C:/Users/acer/Asolaria/data/behcs/laws/LAW-035-remember-this-moment-2026-05-26.hbp',
      supervisor_set: 'C:/Users/acer/Asolaria/data/behcs/supervisors/campaign-mint-2026-05-26/campaign-mint-2026-05-26-supervisors.v1.json',
      mint_heartbeats: 'C:/HyperBEHCS/data/prof-supervisors/CAMPAIGN-MINT-2026-05-26.hbp',
      storage_canon: 'C:/Users/acer/Asolaria/data/behcs/d0-runtime/storage-devices-campaign-2026-05-26.hbp',
      campaign_summary: 'C:/Users/acer/Asolaria/data/behcs/d0-runtime/30-wave-campaign-summary-2026-05-26.hbp',
      honest_residual: 'C:/Users/acer/Asolaria/data/behcs/d0-runtime/post-1e200-campaign-honest-residual-2026-05-26.hbp',
      superdashboard_extension: 'C:/HyperBEHCS/store/asolaria-superdashboard-os-on-metal-history-2026-05-26.md (Section 16 appended)',
    },
    new_prof_mints_count: 18,
    new_supervisor_records_absorbed: 18,
    new_storage_canon_rows: 5,
    new_hbpv1_rows_today: 111,
    cosign_seals_today: [3358, 3360, 3361, 3362, 3363, 3364, 3365, 'this_seal_3366_TBD'],
    universal_route_fires_validated: 3,
    sacred_pids_throughout: 'PID_2424_490MB_+_PID_23708_1.21GB_alive_5h50m_active_32d_total',
    stage_2_drain_state: 'lastGulpedPacket_29.255B_remainingBacklog_70.745B_estimated_complete_2026-05-27T14:51Z',
    deferred_items: [
      'lens_flag_implementation_30_50_LOC',
      '3d_hilbert_per_entity_assignment_30_LOC',
      '18_new_cube_cube_cubed_classes_540_LOC',
      '540_real_claude_agent_spawns_rejected_as_real_agent_storm',
      'brain_load_execution_until_post_Stage_2_drain',
    ],
    honest_residual_categories: [
      'pre_1e200_era_unmapped_226_Plan_B_PDFs_BCI_1994_origin_MLC_2023_v40_descriptors',
      'disconnected_from_PID_fabric_128GB_USB_Samsung_Ultra_D_38TB_Google_falcon_phone_fleet',
      'minted_but_dormant_323_prof_supervisor_heartbeats_frozen_apex_:4949_dead',
      'liris_cosign_chain_frozen_seq_91_37d_stale',
      'foundation_docs_partial_brown-hilbert_01-13_super-startup-guide_02-10',
    ],
    next_campaign_seed: 'documented_in_post-1e200-campaign-honest-residual-2026-05-26.hbp_targets_1_through_7',
    d50_class: 'CAMPAIGN_LOGICAL_CLOSURE_RATIFIABLE_ARTIFACT_per_BH-14',
    bilateral_state: 'acer_canonical_drive_liris_observes_via_subs_1_publish',
  },
  r
);
console.log(
  '30-WAVE-CAMPAIGN-CLOSE SEAL: seq=' +
    seal.cosign.seq +
    ' row=' +
    seal.cosign.row_hash.slice(0, 16) +
    ' subs=' +
    seal.publish.subscribers +
    ' obs_lanes=' +
    (seal.observation
      ? 'hookwall=' + (seal.observation.hookwall?.ok ? 'OK' : 'FAIL') + ',gnn=' + (seal.observation.gnn_edges?.ok ? 'OK' : 'FAIL')
      : 'NONE')
);
r.close();
