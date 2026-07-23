async function run() {
  try {
    const res = await fetch('http://localhost:3001/api/processes');
    if (!res.ok) throw new Error('API fetch failed');
    const list = await res.json();
    console.log('--- API Processes List ---');
    list.forEach(proc => {
      console.log(`Process: ${proc.id} - ${proc.title}`);
      console.log(`Steps:`, JSON.stringify(proc.steps, null, 2));
      console.log('---------------------------');
    });
  } catch (err) {
    console.error('Error fetching API:', err);
  }
}

run();
