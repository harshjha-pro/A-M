// Representative sample data for design frames. Names and numbers are invented; no real guest data.
export const WEDDING = { couple: 'Ayush & Mahi', place: 'Bhilwara', dates: '14–16 Feb 2027', countdown: { months: 3, days: 28, hours: 14 } };

export const EVENTS = [
  { id: 'eng', name: 'Engagement', type: 'Engagement', date: 'Sun 22 Nov 2026', day: 22, mon: 'Nov', time: '6:30 pm', venue: 'Shree Vatika, Bhilwara', photo: 'engagement', in: '36 days', side: 'Both sides' },
  { id: 'meh', name: 'Mehndi', type: 'Mehndi', date: 'Sun 14 Feb 2027', day: 14, mon: 'Feb', time: '11:00 am', venue: 'Porwal Haveli, Bhilwara', photo: 'mehndi', in: '120 days', side: "Bride's side" },
  { id: 'car', name: 'Carnival', type: 'Other', date: 'Sun 14 Feb 2027', day: 14, mon: 'Feb', time: '4:00 pm', venue: 'Porwal Haveli lawn', photo: 'drapes', in: '120 days', side: 'Both sides' },
  { id: 'dj', name: 'DJ Night', type: 'Sangeet', date: 'Sun 14 Feb 2027', day: 14, mon: 'Feb', time: '8:30 pm', venue: 'Porwal Haveli terrace', photo: 'night', in: '120 days', side: 'Both sides' },
  { id: 'may', name: 'Mayra', type: 'Mayra', date: 'Mon 15 Feb 2027', day: 15, mon: 'Feb', time: '10:00 am', venue: 'Jagetiya Niwas, Bhilwara', photo: 'drapes', in: '121 days', side: "Bride's side" },
  { id: 'phe', name: 'Varmala & Phere', type: 'Wedding', date: 'Mon 15 Feb 2027', day: 15, mon: 'Feb', time: '7:30 pm', venue: 'Shree Vatika, Bhilwara', photo: 'phere', in: '121 days', side: 'Both sides' },
  { id: 'rec', name: 'Reception', type: 'Reception', date: 'Tue 16 Feb 2027', day: 16, mon: 'Feb', time: '7:30 pm', venue: 'Hotel Rajmahal, Bhilwara', photo: 'reception', in: '122 days', side: 'Both sides' },
];

export const PEOPLE = {
  ayush: { name: 'Ayush', role: 'owner' },
  mahi: { name: 'Mahi', role: 'partner' },
  papa: { name: 'Papa ji', role: 'family' },
  riya: { name: 'Riya didi', role: 'family' },
  nani: { name: 'Nani', role: 'viewer' },
};

export const TASKS = [
  { code: 'TSK-4KQ7RM', title: 'Confirm caterer menu tasting', status: 'todo', priority: 'urgent', due: 'Overdue · 12 Oct', overdue: true, who: 'Mahi', event: 'Reception', workspace: 'Reception', items: '2/5' },
  { code: 'TSK-8HB2XT', title: 'Book mehndi artist for 40 guests', status: 'doing', priority: 'normal', due: 'Today · 5:00 pm', today: true, who: 'Riya didi', event: 'Mehndi', workspace: 'Mehndi', items: '1/3' },
  { code: 'TSK-2PWN9C', title: 'Final fitting — bridal lehenga', status: 'waiting', priority: 'normal', due: 'Fri 23 Oct', who: 'Mahi', event: 'Varmala & Phere', workspace: 'Varmala & Phere' },
  { code: 'TSK-6VYD3J', title: 'Send engagement invitations', status: 'todo', priority: 'urgent', due: 'Mon 26 Oct', who: 'Ayush', event: 'Engagement', workspace: 'Engagement', items: '0/4' },
  { code: 'TSK-9RF5KA', title: 'Order 20 mehndi cones', status: 'done', priority: 'low', due: 'Done 10 Oct', who: 'Papa ji', event: 'Mehndi', workspace: 'Mehndi' },
  { code: 'TSK-3MT8QE', title: 'Shortlist DJ playlists', status: 'todo', priority: 'low', due: 'No date', who: 'Ayush', event: 'DJ Night', workspace: 'DJ Night' },
];

export const FAMILIES = [
  { name: 'Ramesh Sharma & family', side: 'Groom', phone: '98290 12345', area: 'Shastri Nagar', adults: 4, children: 2, food: 'Veg', jain: 0, rsvp: 'coming', vip: true, group: 'Papa office' },
  { name: 'Suresh Jagetiya & family', side: 'Bride', phone: '94140 22871', area: 'Azad Nagar', adults: 3, children: 1, food: 'Jain', jain: 4, rsvp: 'waiting', group: 'Nanihal (Mama ji)' },
  { name: 'Kavita Porwal', side: 'Both', phone: '', area: 'Udaipur', adults: 1, children: 0, food: 'Veg', jain: 0, rsvp: 'not_asked', noPhone: true },
  { name: 'Dinesh Maheshwari & family', side: 'Groom', phone: '98281 55210', area: 'R.C. Vyas Colony', adults: 5, children: 3, food: 'Mixed', jain: 2, rsvp: 'coming', dup: true },
  { name: 'Anita Kothari & family', side: 'Bride', phone: '99280 44102', area: 'Subhash Nagar', adults: 2, children: 2, food: 'Jain', jain: 4, rsvp: 'not_coming' },
  { name: 'Mahesh Agarwal & family', side: 'Groom', phone: '97845 10023', area: 'Pur Road', adults: 3, children: 0, food: 'Veg', jain: 0, rsvp: 'waiting' },
];

export const PAYMENTS = [
  { title: 'Tent advance', to: 'Shree Tent House', amount: 150000, status: 'paid', date: 'Paid 2 Oct', method: 'UPI', category: 'Tent & decor', event: 'Varmala & Phere' },
  { title: 'Catering — 2nd instalment', to: 'Annapurna Caterers', amount: 225000, status: 'overdue', date: 'Due 12 Oct', category: 'Caterer / Halwai', event: 'Reception' },
  { title: 'Photography booking', to: 'Click Studio Bhilwara', amount: 80000, status: 'due', date: 'Due 30 Oct', category: 'Photo & video', event: 'Varmala & Phere' },
  { title: 'Mehndi artist advance', to: 'Rekha Mehndi Art', amount: 11000, status: 'paid', date: 'Paid 8 Oct', method: 'Cash', category: 'Mehndi artist', event: 'Mehndi' },
  { title: 'Wedding cards printing', to: 'Shubh Printers', amount: 32500, status: 'due', date: 'Due 5 Nov', category: 'Printer' },
];

export const VENDORS = [
  { name: 'Shree Tent House', type: 'Tent & decor', contact: 'Mukesh ji', phone: '98290 77120', workspaces: ['Varmala & Phere', 'Mehndi'] },
  { name: 'Annapurna Caterers', type: 'Caterer / Halwai', contact: 'Gopal ji', phone: '94141 30022', workspaces: ['Reception'] },
  { name: 'Click Studio Bhilwara', type: 'Photo & video', contact: 'Rahul', phone: '98870 11234', workspaces: ['Mehndi', 'Reception'] },
  { name: 'Rekha Mehndi Art', type: 'Mehndi artist', contact: 'Rekha', phone: '99500 66789', workspaces: ['Mehndi'] },
  { name: 'DJ Sonu Beats', type: 'Band / DJ', contact: 'Sonu', phone: '97720 45123', workspaces: ['DJ Night'] },
];

export const WORKSPACES = [
  { id: 'eng', name: 'Engagement', event: 'Sun 22 Nov 2026', photo: 'engagement', pct: 68, open: 7, overdue: 1 },
  { id: 'meh', name: 'Mehndi', event: 'Sun 14 Feb 2027', photo: 'mehndi', pct: 54, open: 9, overdue: 1 },
  { id: 'car', name: 'Carnival', event: 'Sun 14 Feb 2027', photo: 'drapes', pct: 22, open: 5, overdue: 0 },
  { id: 'dj', name: 'DJ Night', event: 'Sun 14 Feb 2027', photo: 'night', pct: 35, open: 4, overdue: 0 },
  { id: 'may', name: 'Mayra', event: 'Mon 15 Feb 2027', photo: 'drapes', pct: 40, open: 6, overdue: 0 },
  { id: 'rec', name: 'Reception', event: 'Tue 16 Feb 2027', photo: 'reception', pct: 47, open: 11, overdue: 2 },
  { id: 'phe', name: 'Varmala & Phere', event: 'Mon 15 Feb 2027', photo: 'phere', pct: 61, open: 12, overdue: 0 },
];

export const ATTACHMENTS = [
  { code: 'ATT-K7Q2MX', title: 'Lehenga reference — blush', kind: 'Photo', photo: 'lehenga', fav: true, used: ['Engagement › Bride outfit'] },
  { code: 'ATT-3HVN8P', title: 'Caterer quotation.pdf', kind: 'Document', size: '412 KB', used: ['Reception › Menu', 'Money › Annapurna Caterers'] },
  { code: 'ATT-9TRB4C', title: 'Stage florals idea', kind: 'Photo', photo: 'stage', used: ['Varmala & Phere › Stage'] },
  { code: 'ATT-5WMA2K', title: 'Sangeet playlist', kind: 'Link', used: ['DJ Night › Files'] },
  { code: 'ATT-2CXF7N', title: 'Sherwani colour swatch', kind: 'Photo', photo: 'sherwani', used: [] },
  { code: 'ATT-8PDQ6R', title: 'Entry video reference', kind: 'Video', photo: 'night', used: ['Reception › Event timeline'] },
  { code: 'ATT-4MKS9T', title: 'Haldi seating note', kind: 'Text', used: ['Mehndi › Guest details'] },
];
