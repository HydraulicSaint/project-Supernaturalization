import { PoolClient } from "pg";

import { db } from "@/lib/db";
import { enrichLocationFromPointWkt } from "@/lib/ingestion/enrichment/geospatialEnrichment";
import { recordHash } from "@/lib/ingestion/utils/hash";
import { AdapterResult, CanonicalCandidate } from "@/lib/ingestion/types";

type PersistOptions = {
  jobRunId?: string;
  enrichLocation?: typeof enrichLocationFromPointWkt;
};

type PersistResult = {
  snapshotId: string;
  recordCount: number;
  canonicalCount: number;
  missingMarkedCount: number;
};

export function locationEventFingerprint(input: {
  caseId: string;
  eventType: string;
  geometryWkt?: string;
  reportedLocationText?: string;
  eventTimeFrom?: string;
  eventTimeTo?: string;
}) {
  return recordHash(input);
}

async function insertDecision(
  client: PoolClient,
  input: {
    jobRunId?: string;
    snapshotId: string;
    sourceRecordId?: string;
    caseId?: string;
    decisionType: string;
    inputsConsidered: Record<string, unknown>;
    ruleTriggered: string;
    previousValue?: unknown;
    newValue?: unknown;
    confidence?: number;
  }
) {
  await client.query(
    `INSERT INTO reconciliation_decision
      (job_run_id, snapshot_id, source_record_id, case_id, decision_type, inputs_considered, rule_triggered, previous_value, new_value, confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      input.jobRunId ?? null,
      input.snapshotId,
      input.sourceRecordId ?? null,
      input.caseId ?? null,
      input.decisionType,
      JSON.stringify(input.inputsConsidered),
      input.ruleTriggered,
      input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
      input.newValue === undefined ? null : JSON.stringify(input.newValue),
      input.confidence ?? null
    ]
  );
}

function fieldUpdates(existing: Record<string, unknown>, candidate: CanonicalCandidate) {
  const updates: Record<string, unknown> = {};
  if (!existing.display_name && candidate.displayName) updates.display_name = candidate.displayName;
  if (candidate.caseStatus && existing.case_status !== "resolved") updates.case_status = candidate.caseStatus;
  if (!existing.missing_from && candidate.missingFrom) updates.missing_from = candidate.missingFrom;
  if (!existing.missing_to && candidate.missingTo) updates.missing_to = candidate.missingTo;
  if ((candidate.narrativeSummary?.length ?? 0) > ((existing.narrative_summary as string | null)?.length ?? 0)) {
    updates.narrative_summary = candidate.narrativeSummary;
  }
  if ((candidate.sourceConfidence ?? 0) > Number(existing.source_confidence ?? 0)) {
    updates.source_confidence = candidate.sourceConfidence;
  }
  if ((candidate.completenessScore ?? 0) > Number(existing.completeness_score ?? 0)) {
    updates.completeness_score = candidate.completenessScore;
  }
  return updates;
}


async function insertCaseConflict(
  client: PoolClient,
  input: {
    caseId: string;
    conflictType: string;
    sourceRecordId?: string;
    previousValue: unknown;
    nextValue: unknown;
    severity?: string;
  }
) {
  if (input.previousValue === input.nextValue || input.previousValue == null || input.nextValue == null) return;
  await client.query(
    `INSERT INTO case_conflict (case_id, conflict_type, source_record_ids, competing_values, severity)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      input.caseId,
      input.conflictType,
      input.sourceRecordId ? [input.sourceRecordId] : [],
      JSON.stringify({ previous: input.previousValue, incoming: input.nextValue }),
      input.severity ?? "medium"
    ]
  );
}

export async function persistAdapterResult(result: AdapterResult, options: PersistOptions = {}): Promise<PersistResult> {
  if (!db) {
    throw new Error("DATABASE_URL is required for ingestion persistence");
  }

  const enrichLocation = options.enrichLocation ?? enrichLocationFromPointWkt;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const contentHash = recordHash({
      rawPayload: result.snapshot.rawPayload,
      rawText: result.snapshot.rawText,
      rawBinaryBase64: result.snapshot.rawBinaryBase64,
      metadata: result.snapshot.metadata
    });

    const snapshotRes = await client.query(
      `INSERT INTO source_snapshot
        (source_system, source_channel, ingestion_mode, source_uri, state_batch, snapshot_at, raw_payload, raw_text, raw_binary_base64, content_hash, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (source_system, source_channel, content_hash)
       DO UPDATE SET snapshot_at = EXCLUDED.snapshot_at, metadata = EXCLUDED.metadata
       RETURNING id`,
      [
        result.snapshot.sourceSystem,
        result.snapshot.sourceChannel,
        result.snapshot.ingestionMode,
        result.snapshot.sourceUri ?? null,
        result.snapshot.stateBatch ?? null,
        result.snapshot.snapshotAt,
        result.snapshot.rawPayload ? JSON.stringify(result.snapshot.rawPayload) : null,
        result.snapshot.rawText ?? null,
        result.snapshot.rawBinaryBase64 ?? null,
        contentHash,
        JSON.stringify(result.snapshot.metadata ?? {})
      ]
    );
    const snapshotId = snapshotRes.rows[0].id as string;

    const sourceRecordIds = new Map<string, string>();
    for (const record of result.records) {
      const recordHashValue = recordHash(record.parsedPayload);
      const recordRes = await client.query(
        `INSERT INTO source_record
          (snapshot_id, source_record_key, source_case_id, record_hash, parsed_payload, parse_confidence, is_inferred, last_seen_at, visibility_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now(),'visible')
         ON CONFLICT (snapshot_id, source_record_key)
         DO UPDATE SET
           source_case_id = EXCLUDED.source_case_id,
           record_hash = EXCLUDED.record_hash,
           parsed_payload = EXCLUDED.parsed_payload,
           parse_confidence = EXCLUDED.parse_confidence,
           is_inferred = EXCLUDED.is_inferred,
           last_seen_at = now(),
           visibility_state = 'visible'
         RETURNING id`,
        [
          snapshotId,
          record.sourceRecordKey,
          record.sourceCaseId ?? null,
          recordHashValue,
          JSON.stringify(record.parsedPayload),
          record.parseConfidence,
          record.isInferred ?? false
        ]
      );
      sourceRecordIds.set(record.sourceRecordKey, recordRes.rows[0].id as string);
    }

    let missingMarkedCount = 0;
    if (result.records.length) {
      const missingRes = await client.query(
        `UPDATE source_record sr
         SET visibility_state = 'missing', last_seen_at = now()
         FROM source_snapshot ss
         WHERE sr.snapshot_id = ss.id
           AND ss.source_system = $1
           AND ss.source_channel = $2
           AND sr.visibility_state = 'visible'
           AND sr.snapshot_id <> $3
           AND NOT (sr.source_record_key = ANY($4::text[]))
         RETURNING sr.id, sr.source_record_key`,
        [
          result.snapshot.sourceSystem,
          result.snapshot.sourceChannel,
          snapshotId,
          result.records.map((record) => record.sourceRecordKey)
        ]
      );
      missingMarkedCount = missingRes.rowCount ?? 0;
      for (const row of missingRes.rows) {
        await insertDecision(client, {
          jobRunId: options.jobRunId,
          snapshotId,
          sourceRecordId: row.id,
          decisionType: "mark_source_missing",
          inputsConsidered: { sourceRecordKey: row.source_record_key },
          ruleTriggered: "record_not_present_in_latest_snapshot",
          previousValue: { visibilityState: "visible" },
          newValue: { visibilityState: "missing" },
          confidence: 0.99
        });
      }
    }

    let canonicalCount = 0;
    for (const candidate of result.candidates) {
      const sourceRecordId = sourceRecordIds.get(candidate.canonicalCaseRef) ?? sourceRecordIds.get(candidate.sourceCaseId ?? "");

      let caseRes = await client.query(`SELECT * FROM case_canonical WHERE canonical_case_ref = $1`, [candidate.canonicalCaseRef]);
      let decisionType = "attach_to_existing_case";
      let decisionRule = "canonical_case_ref_match";

      if (!caseRes.rowCount && candidate.sourceCaseId) {
        caseRes = await client.query(
          `SELECT cc.*
           FROM case_canonical cc
           JOIN case_source_link csl ON csl.case_id = cc.id
           WHERE csl.source_system = $1 AND csl.source_case_id = $2
           ORDER BY csl.last_linked_at DESC
           LIMIT 1`,
          [candidate.sourceSystem, candidate.sourceCaseId]
        );
        if (caseRes.rowCount) {
          decisionRule = "source_case_id_link_match";
        }
      }

      let caseId: string;
      if (!caseRes.rowCount) {
        const inserted = await client.query(
          `INSERT INTO case_canonical
            (canonical_case_ref, display_name, demographics, missing_from, missing_to, case_status, narrative_summary, source_confidence, completeness_score, anomaly_tags, motif_tags, jurisdiction, agency, provenance, inferred_fields)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (canonical_case_ref)
           DO UPDATE SET updated_at = now()
           RETURNING id`,
          [
            candidate.canonicalCaseRef,
            candidate.displayName ?? null,
            JSON.stringify(candidate.demographics ?? {}),
            candidate.missingFrom ?? null,
            candidate.missingTo ?? null,
            candidate.caseStatus ?? null,
            candidate.narrativeSummary ?? null,
            candidate.sourceConfidence ?? null,
            candidate.completenessScore ?? null,
            candidate.anomalyTags ?? [],
            candidate.motifTags ?? [],
            JSON.stringify(candidate.jurisdiction ?? {}),
            JSON.stringify(candidate.agency ?? {}),
            JSON.stringify(candidate.provenance ?? {}),
            candidate.inferredFields ?? []
          ]
        );
        caseId = inserted.rows[0].id as string;
        if (!caseRes.rowCount) {
          decisionType = "new_canonical_case";
          decisionRule = "no_existing_match";
        }
      } else {
        caseId = caseRes.rows[0].id as string;
        const updates = fieldUpdates(caseRes.rows[0], candidate);
        if (Object.keys(updates).length) {
          const setClause = Object.keys(updates)
            .map((key, idx) => `${key} = $${idx + 2}`)
            .concat("updated_at = now()")
            .join(", ");
          const values = [caseId, ...Object.values(updates)];
          await client.query(`UPDATE case_canonical SET ${setClause} WHERE id = $1`, values);

          for (const [field, newValue] of Object.entries(updates)) {
            const previousValue = caseRes.rows[0][field];
            if (field === "case_status") {
              await insertCaseConflict(client, {
                caseId,
                sourceRecordId,
                conflictType: "conflicting_status",
                previousValue,
                nextValue: newValue,
                severity: "high"
              });
            }
            if (field === "missing_from") {
              await insertCaseConflict(client, {
                caseId,
                sourceRecordId,
                conflictType: "conflicting_missing_date",
                previousValue,
                nextValue: newValue,
                severity: "high"
              });
            }
            if (field === "narrative_summary") {
              await insertCaseConflict(client, {
                caseId,
                sourceRecordId,
                conflictType: "conflicting_location_description",
                previousValue,
                nextValue: newValue,
                severity: "medium"
              });
            }
            await insertDecision(client, {
              jobRunId: options.jobRunId,
              snapshotId,
              sourceRecordId,
              caseId,
              decisionType: "update_canonical_fields",
              inputsConsidered: { canonicalCaseRef: candidate.canonicalCaseRef, field },
              ruleTriggered: "prefer_more_complete_or_higher_confidence",
              previousValue: caseRes.rows[0][field],
              newValue,
              confidence: candidate.sourceConfidence
            });
          }
        }
      }

      await insertDecision(client, {
        jobRunId: options.jobRunId,
        snapshotId,
        sourceRecordId,
        caseId,
        decisionType: decisionType,
        inputsConsidered: {
          canonicalCaseRef: candidate.canonicalCaseRef,
          sourceSystem: candidate.sourceSystem,
          sourceCaseId: candidate.sourceCaseId ?? null
        },
        ruleTriggered: decisionRule,
        previousValue: null,
        newValue: { caseId },
        confidence: candidate.sourceConfidence
      });

      if (sourceRecordId) {
        await client.query(
          `INSERT INTO case_source_link
            (case_id, source_record_id, source_system, source_case_id, relationship_type, link_confidence)
           VALUES ($1,$2,$3,$4,'matched',$5)
           ON CONFLICT (case_id, source_record_id)
           DO UPDATE SET last_linked_at = now(), link_confidence = EXCLUDED.link_confidence`,
          [caseId, sourceRecordId, candidate.sourceSystem, candidate.sourceCaseId ?? null, candidate.sourceConfidence ?? null]
        );
      }

      for (const location of candidate.locations ?? []) {
        const fingerprint = locationEventFingerprint({
          caseId,
          eventType: location.eventType,
          geometryWkt: location.geometryWkt,
          reportedLocationText: location.reportedLocationText,
          eventTimeFrom: undefined,
          eventTimeTo: undefined
        });
        const locationRes = await client.query(
          `INSERT INTO location_event
            (case_id, source_record_id, event_type, reported_location_text, geometry, geometry_type, geom_method, precision_meters, location_confidence, confidence_score, is_centroid, provenance, event_fingerprint)
           VALUES (
            $1,$2,$3,$4,
            CASE WHEN $5::text IS NULL THEN NULL ELSE ST_GeomFromText($5, 4326) END,
            $6,$7,$8,$9,$10,$11,$12,$13
           )
           ON CONFLICT (event_fingerprint)
           DO UPDATE SET
             source_record_id = COALESCE(location_event.source_record_id, EXCLUDED.source_record_id),
             confidence_score = EXCLUDED.confidence_score,
             precision_meters = EXCLUDED.precision_meters,
             provenance = EXCLUDED.provenance
           RETURNING id, ST_AsText(geometry) AS geometry_wkt`,
          [
            caseId,
            sourceRecordId ?? null,
            location.eventType,
            location.reportedLocationText ?? null,
            location.geometryWkt ?? null,
            location.geometryType ?? null,
            location.geomMethod ?? null,
            location.precisionMeters ?? null,
            location.locationConfidence,
            candidate.sourceConfidence ?? null,
            location.isCentroid ?? false,
            JSON.stringify(candidate.provenance ?? {}),
            fingerprint
          ]
        );

        const persistedLocation = locationRes.rows[0] as { id: string; geometry_wkt: string | null };
        if (persistedLocation?.geometry_wkt) {
          const enrichment = await enrichLocation(persistedLocation.geometry_wkt);
          await client.query(
            `INSERT INTO environment_snapshot
              (case_id, location_event_id, source, nearest_water_m, nearest_trail_m, nearest_road_m, elevation_m, admin_membership, park_membership, confidence_score, reference_layer_snapshot, stale_reference_data, provenance)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (location_event_id, source)
             DO UPDATE SET
               nearest_water_m = EXCLUDED.nearest_water_m,
               nearest_trail_m = EXCLUDED.nearest_trail_m,
               nearest_road_m = EXCLUDED.nearest_road_m,
               elevation_m = EXCLUDED.elevation_m,
               admin_membership = EXCLUDED.admin_membership,
               park_membership = EXCLUDED.park_membership,
               confidence_score = EXCLUDED.confidence_score,
               reference_layer_snapshot = EXCLUDED.reference_layer_snapshot,
               stale_reference_data = false,
               provenance = EXCLUDED.provenance,
               captured_at = now()`,
            [
              caseId,
              persistedLocation.id,
              "postgis_reference_layers",
              enrichment.nearestWaterMeters ?? null,
              enrichment.nearestTrailMeters ?? null,
              enrichment.nearestRoadMeters ?? null,
              enrichment.elevationMeters ?? null,
              JSON.stringify(enrichment.adminMembership ?? {}),
              JSON.stringify(enrichment.protectedAreaMembership ?? {}),
              candidate.sourceConfidence ?? null,
              JSON.stringify(enrichment.referenceLayerSnapshot ?? {}),
              false,
              JSON.stringify({ method: enrichment.method, layerSnapshot: enrichment.referenceLayerSnapshot ?? {} })
            ]
          );
        }
      }

      canonicalCount += 1;
    }

    for (const issue of result.issues) {
      await client.query(
        `INSERT INTO ingestion_issue
          (job_run_id, snapshot_id, severity, issue_type, field_path, message, context, recoverable)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          options.jobRunId ?? null,
          snapshotId,
          issue.severity,
          issue.issueType,
          issue.fieldPath ?? null,
          issue.message,
          JSON.stringify(issue.context ?? {}),
          issue.recoverable ?? true
        ]
      );
      if (issue.severity === "error") {
        await insertDecision(client, {
          jobRunId: options.jobRunId,
          snapshotId,
          decisionType: "create_conflict_issue",
          inputsConsidered: { issueType: issue.issueType, fieldPath: issue.fieldPath ?? null },
          ruleTriggered: "adapter_reported_issue",
          newValue: issue,
          confidence: 0.5
        });
      }
    }

    await client.query("COMMIT");
    return {
      snapshotId,
      recordCount: result.records.length,
      canonicalCount,
      missingMarkedCount
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
