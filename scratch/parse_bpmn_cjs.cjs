const { BpmnModdle } = require('bpmn-moddle');
const fs = require('fs');

const xml = fs.readFileSync('scratch/test.xml', 'utf8');

const moddle = new BpmnModdle();
console.log('Starting XML parse...');
moddle.fromXML(xml)
  .then(result => {
    console.log('Promise resolved!');
    console.log('XML parsed successfully!');
    if (result.warnings && result.warnings.length > 0) {
      console.log('Warnings:', result.warnings);
    } else {
      console.log('No warnings.');
    }
  })
  .catch(err => {
    console.error('Promise rejected with error:', err);
  });

setTimeout(() => {
  console.log('Timeout finished.');
}, 2000);
