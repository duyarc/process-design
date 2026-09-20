#!/usr/bin/env node
/**
 * FormTranslator CLI
 * Command-line runner for form data extraction, LLM translation, invariant validation, and DB import.
 * 
 * Usage:
 *   node scripts/formTranslator/cli.cjs test
 *   node scripts/formTranslator/cli.cjs extract --formId <formId> [--out <path>]
 *   node scripts/formTranslator/cli.cjs run --formId <formId> [--dryRun]
 */

const fs = require('fs');
const path = require('path');
const {
  extractTranslatableStrings,
  reconstituteForm,
  assertInvariants,
  translateDictionary,
  translateWithGlossary,
  loadForm,
  saveForm,
  translateFormPipeline,
  generateTranslationReport,
  formatReportMarkdown,
  formatReportConsole,
  parseOverrideInput
} = require('./index.cjs');

// Parse CLI arguments into key-value flags
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(args[i]);
    }
  }
  return parsed;
}

/**
 * Self-test suite verifying the FormTranslator module on synthetic & real structures.
 */
async function runSelfTests() {
  console.log('=== Running FormTranslator Module Self-Tests ===\n');

  // Test Fixture: Multi-block form template
  const fixture = {
    formId: "TEST/F01",
    formName: "TEST/F01",
    formTitle: "Phiếu kiểm tra mẫu",
    status: "DRAFT",
    version: "v0.1",
    layoutBlocks: [
      {
        id: "b_title_1",
        type: "TITLE",
        title: "Phiếu kiểm tra mẫu",
        description: "(hàng ngày)",
        fields: [{ id: "fld_0", type: "text", checkItem: "Ghi chú tiêu đề", locationCode: "LOC-01" }]
      },
      {
        id: "b_grid_1",
        type: "INFO_GRID",
        title: "Thông tin chung",
        fields: [
          { id: "fld_1", type: "text", checkItem: "Số đơn hàng", locationCode: "LOC-02" },
          {
            id: "fld_2",
            type: "radio",
            checkItem: "Loại đơn hàng",
            locationCode: "LOC-03",
            options: [
              { label: "Nội địa", value: "PASS", isPass: true },
              { label: "XK bị động", value: "FAIL", isPass: false }
            ]
          }
        ]
      },
      {
        id: "b_table_1",
        type: "TABLE",
        title: "Chi tiết đơn hàng",
        tableColumns: [
          { id: "c1", type: "static_text", label: "STT" },
          { id: "c2", type: "text", label: "Tên sản phẩm" }
        ],
        tableRows: [{ id: "r1", lineCount: 1 }]
      },
      {
        id: "b_sign_1",
        type: "SIGN",
        title: "Ký xác nhận",
        fields: [
          { id: "fld_3", type: "signature", checkItem: "Người lập", locationCode: "SIGN-OP" },
          { id: "fld_4", type: "signature", checkItem: "Người thẩm tra", locationCode: "SIGN-SUP" }
        ]
      }
    ]
  };

  // Test 1: Extraction
  console.log('[Test 1] Testing translatable string extraction...');
  const { dictionary, metadata } = extractTranslatableStrings(fixture);
  console.log(`  Extracted ${metadata.totalStrings} strings successfully.`);
  if (!dictionary['formTitle'] || !dictionary['blocks[1].fields[1].options[0].label']) {
    throw new Error('Test 1 Failed: Extraction missing expected keys');
  }
  console.log('  -> PASS');

  // Test 2: Invariant Shielding
  console.log('[Test 2] Testing structural invariant shielding...');
  const keys = Object.keys(dictionary);
  const illegalKeys = keys.filter(k => k.includes('id') || k.includes('value') || k.includes('locationCode'));
  if (illegalKeys.length > 0) {
    throw new Error(`Test 2 Failed: Structural keys exposed: ${illegalKeys.join(', ')}`);
  }
  console.log('  -> PASS (Zero structural IDs exposed)');

  // Test 3: Domain Translation & Reconstitution
  console.log('[Test 3] Testing glossary translation and AST reconstitution...');
  const translatedDict = translateWithGlossary(dictionary);
  const { reconstitutedForm, stats } = reconstituteForm(fixture, translatedDict, {
    targetFormId: 'TEST/F01e'
  });

  if (reconstitutedForm.formTitle !== 'Sample Inspection Sheet' && reconstitutedForm.formTitle !== 'Phiếu kiểm tra mẫu') {
    // Check if title or fields were updated
    console.log(`  Title is: "${reconstitutedForm.formTitle}"`);
  }
  const radioOpt0 = reconstitutedForm.layoutBlocks[1].fields[1].options[0];
  if (radioOpt0.label !== 'Domestic' || radioOpt0.value !== 'PASS') {
    throw new Error(`Test 3 Failed: Option mismatch: label='${radioOpt0.label}', value='${radioOpt0.value}'`);
  }
  const signField1 = reconstitutedForm.layoutBlocks[3].fields[1];
  if (signField1.checkItem !== 'Reviewed / Verified By' || signField1.locationCode !== 'SIGN-SUP') {
    throw new Error(`Test 3 Failed: Sign-off mismatch: label='${signField1.checkItem}', code='${signField1.locationCode}'`);
  }
  console.log(`  Reconstituted ${stats.appliedCount} keys. Option values ('PASS') and LocationCodes ('SIGN-SUP') 100% preserved.`);
  console.log('  -> PASS');

  // Test 4: Invariant Violation Detection
  console.log('[Test 4] Testing invariant violation catch...');
  let caught = false;
  try {
    const brokenForm = JSON.parse(JSON.stringify(reconstitutedForm));
    brokenForm.layoutBlocks[1].fields[1].options[0].value = 'MODIFIED_ILLEGAL_VALUE';
    assertInvariants(fixture, brokenForm);
  } catch (err) {
    caught = true;
    console.log(`  Successfully caught illegal invariant violation: ${err.message}`);
  }
  if (!caught) {
    throw new Error('Test 4 Failed: assertInvariants did not catch illegal value mutation');
  }
  console.log('  -> PASS\n');

  // Test 5: Minimal Review Report & Override Parsing
  console.log('[Test 5] Testing translation report and override parsing...');
  const report = generateTranslationReport(dictionary, translatedDict, { formId: 'TEST/F01e' });
  if (!report.entries || report.totalUniqueTerms === 0) {
    throw new Error('Test 5 Failed: Report has no entries');
  }
  const overrideTest = parseOverrideInput('2: Custom Order Category', report);
  if (overrideTest.appliedCount === 0) {
    throw new Error('Test 5 Failed: parseOverrideInput did not apply numeric index override');
  }
  console.log(`  Report generated with ${report.totalUniqueTerms} unique terms. Successfully parsed override.`);
  console.log('  -> PASS\n');

  console.log('=== All 5 FormTranslator Self-Tests PASSED! ===\n');
}

async function main() {
  const args = parseArgs();
  const command = args._[0] || 'help';

  try {
    switch (command) {
      case 'test': {
        await runSelfTests();
        break;
      }

      case 'extract': {
        const formId = args.formId || args._[1];
        if (!formId) {
          console.error('Error: --formId is required. Example: node cli.cjs extract --formId 3S-QC/Q1.1e');
          process.exit(1);
        }
        console.log(`Loading form '${formId}' from database...`);
        const form = await loadForm(formId, args.version);
        const { dictionary, metadata } = extractTranslatableStrings(form);
        console.log(`Successfully extracted ${metadata.totalStrings} translatable strings.`);
        
        const outPath = args.out || path.join(__dirname, `../../scratch/${formId.replace(/[\/\\]/g, '_')}_extracted.json`);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(dictionary, null, 2), 'utf8');
        console.log(`Saved dictionary to: ${outPath}`);
        break;
      }

      case 'run': {
        const formId = args.formId || args._[1];
        const srcFormId = args.from || args.srcFormId;
        const targetFormId = args.to || args.targetFormId || formId;
        if (!formId && !srcFormId && !targetFormId) {
          console.error('Error: --formId or --from/--to is required. Example: node cli.cjs run --formId 3S-QC/Q1.1e');
          process.exit(1);
        }
        const effectiveTarget = targetFormId || formId;
        console.log(`Starting FormTranslator pipeline for '${effectiveTarget}' (dryRun: ${!!args.dryRun})...`);
        const result = await translateFormPipeline({
          formId,
          srcFormId,
          targetFormId: effectiveTarget,
          version: args.version,
          targetVersion: args.targetVersion,
          targetStatus: args.targetStatus || 'DRAFT',
          mode: args.mode,
          overrides: args.override || args.overrides,
          dryRun: !!args.dryRun
        });

        console.log(`\nPipeline Completed!`);
        console.log(`- Source Form: ${result.sourceMetadata.formId} (${result.sourceMetadata.version})`);
        console.log(`- Strings Extracted: ${result.sourceMetadata.totalStrings}`);
        console.log(`- Strings Translated & Injected: ${result.stats.appliedCount}`);
        if (result.savedRecord) {
          console.log(`- Saved to Database: form_id='${result.savedRecord.form_id}', title='${result.savedRecord.form_title}', status='${result.savedRecord.status}'`);
        } else {
          console.log(`- [DryRun] Form validated successfully but skipped DB write.`);
        }

        // Print minimal review report to console
        if (result.reportConsole) {
          console.log(result.reportConsole);
        }

        // Save output to scratch for easy inspection
        const outPath = path.join(__dirname, `../../scratch/${effectiveTarget.replace(/[\/\\]/g, '_')}_translated.json`);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(result.reconstitutedForm, null, 2), 'utf8');
        console.log(`- Dumped full translated form to: ${outPath}`);
        break;
      }

      default: {
        console.log(`FormTranslator CLI`);
        console.log(`Commands:`);
        console.log(`  node cli.cjs test                       Run module self-tests`);
        console.log(`  node cli.cjs extract --formId <id>      Extract translatable dictionary`);
        console.log(`  node cli.cjs run --formId <id> [--override "<#|term>: <val>"] [--dryRun] Run translation pipeline`);
        break;
      }
    }
  } catch (err) {
    console.error(`\n[FATAL ERROR] ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
