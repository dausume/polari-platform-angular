/* Real payloads captured 2026-08-29 from the live node:
 *   GET /GraphDefinition (row cnt-device-transfer-states)
 *   GET /api/cntfet/device/{d}/points?curve=transfer-states
 * for d = si-nmos-planar-90 and cnt-aligned-s1. Used by
 * named-graph-long-form.spec.ts — do not hand-edit. */

export const TRANSFER_STATES_GRAPHDEF: any = {
 "id": "I7Ax3lBql",
 "name": "cnt-device-transfer-states",
 "description": "Operating STATES on the transfer curve: off / transition / on-linear / on-saturation shaded, with the qualifying boundaries Vt(Vds) and Vt + Vov_min as guides — what qualifies each state, on the curve it governs — data: /api/cntfet/device/{name}/points?curve=transfer-states",
 "source_class": "AlignedCNTFETDevice",
 "definition": "{\"graphConfig\": {\"renderStyle\": \"lineY\", \"xDimension\": \"x\", \"yDimensions\": [\"y\"], \"seriesDimension\": \"series\", \"styleDimension\": \"style\", \"seriesColors\": [], \"options\": {\"showLegend\": true, \"showGrid\": true, \"xLabel\": \"Vg (V)\", \"yLabel\": \"Id (uA)\", \"yType\": \"log\"}, \"aggregation\": null}}"
};

export const SI_TRANSFER_STATES_ROWS: any[] = [
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.0,
  "y": 0.005415993040612351
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.02,
  "y": 0.010848939618520083
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.04,
  "y": 0.021568421578080196
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.06,
  "y": 0.04249492099429442
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.08,
  "y": 0.08283607810698636
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.1,
  "y": 0.15945800326068724
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.12,
  "y": 0.3024758573309398
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.14,
  "y": 0.5640217430384212
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.16,
  "y": 1.030935282123317
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.18,
  "y": 1.8408790499628276
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.2,
  "y": 3.198031822260185
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.22,
  "y": 5.378333628697353
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.24,
  "y": 8.707873964205902
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.26,
  "y": 13.501548605366668
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.28,
  "y": 19.974328934035583
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.3,
  "y": 28.171827042760874
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.32,
  "y": 37.966541289001846
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.34,
  "y": 49.11786938372052
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.36,
  "y": 61.35113188628877
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.38,
  "y": 74.4152226802305
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.4,
  "y": 88.10795243744788
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.42,
  "y": 102.27804038499603
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.44,
  "y": 116.81622807068875
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.46,
  "y": 131.64394255822936
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.48,
  "y": 146.7034202060622
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.5,
  "y": 161.95040317243922
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.52,
  "y": 177.34924414826227
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.54,
  "y": 192.8698486890468
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.56,
  "y": 208.4858696684629
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.58,
  "y": 224.17368787855037
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.6,
  "y": 239.911851847946
 },
 {
  "series": "off",
  "style": "band",
  "dash": false,
  "x": 0.0,
  "lo": 0.005415993040612351,
  "hi": 239.911851847946
 },
 {
  "series": "off",
  "style": "band",
  "dash": false,
  "x": 0.325,
  "lo": 0.005415993040612351,
  "hi": 239.911851847946
 },
 {
  "series": "transition-on",
  "style": "band",
  "dash": false,
  "x": 0.325,
  "lo": 0.005415993040612351,
  "hi": 239.911851847946
 },
 {
  "series": "transition-on",
  "style": "band",
  "dash": false,
  "x": 0.515,
  "lo": 0.005415993040612351,
  "hi": 239.911851847946
 },
 {
  "series": "on-saturation",
  "style": "band",
  "dash": false,
  "x": 0.515,
  "lo": 0.005415993040612351,
  "hi": 239.911851847946
 },
 {
  "series": "on-saturation",
  "style": "band",
  "dash": false,
  "x": 0.6,
  "lo": 0.005415993040612351,
  "hi": 239.911851847946
 },
 {
  "series": "Vt",
  "style": "guide",
  "dash": true,
  "x": 0.32473339145679253,
  "label": "Vt",
  "y": null
 },
 {
  "series": "Vt + Vov_min",
  "style": "guide",
  "dash": true,
  "x": 0.5142911804321206,
  "label": "Vt + Vov_min",
  "y": null
 }
];

export const CNT_TRANSFER_STATES_ROWS: any[] = [
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.0,
  "y": 0.0008299166388508522
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.02,
  "y": 0.0017115267238950033
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.04,
  "y": 0.003493795770380771
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.06,
  "y": 0.007046318682810894
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.08,
  "y": 0.014010118945782172
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.1,
  "y": 0.027393169440221247
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.12,
  "y": 0.052510707199038276
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.14,
  "y": 0.0983147570694479
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.16,
  "y": 0.17892243661948862
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.18,
  "y": 0.31460732777547756
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.2,
  "y": 0.5307815472313918
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.22,
  "y": 0.8534856052679138
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.24,
  "y": 1.3020219632647194
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.26,
  "y": 1.8827297439983375
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.28,
  "y": 2.588117402779871
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.3,
  "y": 3.401258948820151
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.32,
  "y": 4.301757537867227
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.34,
  "y": 5.270161188950559
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.36,
  "y": 6.290073123014773
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.38,
  "y": 7.348593897572196
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.4,
  "y": 8.435929634757272
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.42,
  "y": 9.544728835464324
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.44,
  "y": 10.669428016272343
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.46,
  "y": 11.805710859854381
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.48,
  "y": 12.950099346329885
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.5,
  "y": 14.099660848175933
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.52,
  "y": 15.251805765556707
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.54,
  "y": 16.40415136370432
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.56,
  "y": 17.55443205602374
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.58,
  "y": 18.70044144070454
 },
 {
  "series": "Id, Vd = 0.6 V",
  "style": "line",
  "dash": false,
  "x": 0.6,
  "y": 19.839995818630122
 },
 {
  "series": "off",
  "style": "band",
  "dash": false,
  "x": 0.0,
  "lo": 0.0008299166388508522,
  "hi": 19.839995818630122
 },
 {
  "series": "off",
  "style": "band",
  "dash": false,
  "x": 0.3,
  "lo": 0.0008299166388508522,
  "hi": 19.839995818630122
 },
 {
  "series": "transition-on",
  "style": "band",
  "dash": false,
  "x": 0.3,
  "lo": 0.0008299166388508522,
  "hi": 19.839995818630122
 },
 {
  "series": "transition-on",
  "style": "band",
  "dash": false,
  "x": 0.48,
  "lo": 0.0008299166388508522,
  "hi": 19.839995818630122
 },
 {
  "series": "on-saturation",
  "style": "band",
  "dash": false,
  "x": 0.48,
  "lo": 0.0008299166388508522,
  "hi": 19.839995818630122
 },
 {
  "series": "on-saturation",
  "style": "band",
  "dash": false,
  "x": 0.6,
  "lo": 0.0008299166388508522,
  "hi": 19.839995818630122
 },
 {
  "series": "Vt",
  "style": "guide",
  "dash": true,
  "x": 0.2961041345293709,
  "label": "Vt",
  "y": null
 },
 {
  "series": "Vt + Vov_min",
  "style": "guide",
  "dash": true,
  "x": 0.4751546920039458,
  "label": "Vt + Vov_min",
  "y": null
 }
];
