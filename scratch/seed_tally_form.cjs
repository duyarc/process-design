const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const TALLY_PROCESS_ID = 'proc_tally_counting';

const seedData = {
  id: TALLY_PROCESS_ID,
  title: 'Quy trình kiểm đếm hàng hóa lên container',
  description: 'Quy trình kiểm soát số lượng sản phẩm xếp vào container, đảm bảo chính xác chủng loại và số lượng theo kế hoạch.',
  version: 'v1.0',
  status: 'ACTIVE',
  lastUpdated: new Date().toISOString(),
  roles: [],
  steps: [],
  formFields: [],
  sopSignoffs: [],
  workflowFormsData: {
    'Phiếu kiểm đếm': {
      formId: 'Phiếu kiểm đếm',
      formTitle: 'PHIẾU KIỂM ĐẾM',
      version: 'v1.0 (2026-07-03)',
      status: 'ACTIVE',
      revisionHistory: [
        {
          version: 'v1.0',
          date: '2026-07-03',
          author: 'QA Administrator',
          change: 'Khởi tạo form kiểm đếm hàng hóa với Matrix Tally Grid.'
        }
      ],
      layoutBlocks: [
        {
          id: 'b_title_1001',
          type: 'TITLE',
          columns: 1,
          title: 'PHIẾU KIỂM ĐẾM',
          fields: [
            {
              id: 'f_desc_1001',
              type: 'text',
              checkItem: '(kiểm tra và đảm bảo đúng loại, đúng số lượng hàng được load lên container)',
              frequency: 'Once/Shift',
              locationCode: 'TITLE-DESC',
              reactionProtocol: ''
            }
          ],
          logo: 'uploads/default_logo.png' // default logo
        },
        {
          id: 'b_info_1002',
          type: 'INFO_GRID',
          columns: 2,
          title: 'Thông tin chung',
          fields: [
            {
              id: 'f_info_booking',
              type: 'text',
              checkItem: 'Booking',
              frequency: 'Once/Shift',
              locationCode: 'INFO-BOOKING',
              reactionProtocol: ''
            },
            {
              id: 'f_info_donhang',
              type: 'text',
              checkItem: 'Số đơn hàng',
              frequency: 'Once/Shift',
              locationCode: 'INFO-DONHANG',
              reactionProtocol: ''
            },
            {
              id: 'f_info_hangtau',
              type: 'text',
              checkItem: 'Hãng tàu',
              frequency: 'Once/Shift',
              locationCode: 'INFO-HANGTAU',
              reactionProtocol: ''
            },
            {
              id: 'f_info_lot',
              type: 'text',
              checkItem: 'Số LOT',
              frequency: 'Once/Shift',
              locationCode: 'INFO-LOT',
              reactionProtocol: ''
            },
            {
              id: 'f_info_container',
              type: 'text',
              checkItem: 'Số Container',
              frequency: 'Once/Shift',
              locationCode: 'INFO-CONTAINER',
              reactionProtocol: ''
            },
            {
              id: 'f_info_date',
              type: 'date',
              checkItem: 'Ngày',
              frequency: 'Once/Shift',
              locationCode: 'INFO-DATE',
              reactionProtocol: ''
            },
            {
              id: 'f_info_seal',
              type: 'text',
              checkItem: 'Số Seal',
              frequency: 'Once/Shift',
              locationCode: 'INFO-SEAL',
              reactionProtocol: ''
            },
            {
              id: 'f_info_size',
              type: 'radio',
              checkItem: 'Size Container',
              frequency: 'Once/Shift',
              locationCode: 'INFO-SIZE',
              reactionProtocol: '',
              options: [
                { label: '40', value: '40', isPass: true },
                { label: '20', value: '20', isPass: true }
              ]
            },
            {
              id: 'f_info_time_start',
              type: 'text',
              checkItem: 'Thời gian Từ',
              frequency: 'Once/Shift',
              locationCode: 'INFO-TIME-START',
              reactionProtocol: ''
            },
            {
              id: 'f_info_time_end',
              type: 'text',
              checkItem: 'đến',
              frequency: 'Once/Shift',
              locationCode: 'INFO-TIME-END',
              reactionProtocol: ''
            }
          ]
        },
        {
          id: 'b_matrix_1003',
          type: 'MATRIX_TABLE',
          columns: 1,
          title: 'Chi tiết kiểm đếm số lượng hàng hóa',
          fields: [],
          matrixConfig: {
            rowHeader: 'Lớp',
            rowCount: 17,
            columnHeader: 'Tên hàng, quy cách',
            columns: ['SP 1', 'SP 2', 'SP 3', ' ', '  '], // 5 columns (3 named, 2 blank spaces)
            showTotalColumn: true,
            totalColumnHeader: 'Tổng mỗi lớp (bao/carton)',
            showNotesColumn: true,
            notesColumnHeader: 'Ghi chú'
          }
        }
      ]
    }
  }
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if default_logo exists in processes to copy its logo url if any
    const logoRes = await pool.query("SELECT \"workflowFormsData\"->'Phiếu kiểm tra container rỗng'->>'logo' as logo FROM processes WHERE id = 'proc_container_inspection'");
    if (logoRes.rows.length > 0 && logoRes.rows[0].logo) {
      seedData.workflowFormsData['Phiếu kiểm đếm'].layoutBlocks[0].logo = logoRes.rows[0].logo;
      console.log('Copied Farmgate logo from existing process:', logoRes.rows[0].logo);
    }

    // Delete existing process if any
    await pool.query('DELETE FROM processes WHERE id = $1', [TALLY_PROCESS_ID]);

    // Insert new process matching the database schema
    await pool.query(
      `INSERT INTO processes (id, title, description, version, status, "lastUpdated", roles, steps, "formFields", "sopSignoffs", "workflowFormsData") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        seedData.id,
        seedData.title,
        seedData.description,
        seedData.version,
        seedData.status,
        seedData.lastUpdated,
        JSON.stringify(seedData.roles),
        JSON.stringify(seedData.steps),
        JSON.stringify(seedData.formFields),
        JSON.stringify(seedData.sopSignoffs),
        seedData.workflowFormsData
      ]
    );

    console.log(`Successfully seeded tally checklist form process: "${seedData.title}" (ID: ${seedData.id})`);
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await pool.end();
  }
}

main();
