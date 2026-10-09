// Demo people from db/dev/seed_demo.sql (password demo-1234).
export const DEMO = {
  ayush: { phone: '9829000001', name: 'Ayush Porwal' },
  mahi: { phone: '9829000002', name: 'Mahi Jagetiya' },
  papa: { phone: '9829000004', name: 'Rajendra Porwal (Papa)' },
  kavita: { phone: '9829000005', name: 'Kavita' }, // Family, money off
  dadi: { phone: '9829000006', name: 'कमला देवी पोरवाल (Dadi)' },
};
export const PASSWORD = 'demo-1234';

export async function login(page, who, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Phone number').fill(DEMO[who].phone);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('heading', { level: 1, name: 'Home' }).waitFor();
}

/** Console errors and CSP violations fail the test. */
export function watchProblems(page) {
  const problems = [];
  page.on('console', (m) => {
    // A 401 on purpose (logged out) shows as a failed resource load: not a problem.
    if (m.type() === 'error' && !/status of 401|status of 403/.test(m.text())) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
}
