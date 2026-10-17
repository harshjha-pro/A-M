import json, os, sys, html
sys.path.insert(0, os.path.dirname(__file__))
from components_spec import C
from screens_spec import P
ROOT = sys.argv[1]; comp = ROOT + '/components'
HELP = "const h=React.createElement;const row=(...k)=>h('div',{style:{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}},...k);const col=(...k)=>h('div',{style:{display:'flex',flexDirection:'column',gap:14,maxWidth:420}},...k);"
def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(s)
names = []
for name, group, height, expr, summary, guide, props in C:
    names.append(name)
    write(f"{comp}/{name}/preview.html", f'<!-- @dsCard group="{group}" height={height} -->\n<div id="root" class="am-root" style="padding:16px;background:var(--bg);color:var(--text)"></div>\n<script>{HELP}\nReactDOM.createRoot(document.getElementById("root")).render(h(React.Fragment,null,{expr}));</script>\n')
    write(f"{comp}/{name}/README.md", f"# {name}\n\n{summary}\n\n## Use it\n\n{guide}\n\n## Props\n\n`{props}`\n\nAll colours, spacing and radii come from the tokens; the component never hard-codes a value.\n")
json.dump(names, open(os.path.join(os.path.dirname(__file__), '..', 'src', 'components.json'), 'w'))
# screen pages
for folder, group, title, note, frames, kind in P:
    if kind == 'desk': group = '13 · Responsive desktop'
    if kind == 'proto': group = '14 · Prototype'
    n = len(frames)
    if kind in ('phone', 'dark'): width = 48 + n * 390 + (n - 1) * 32 + 40; height = max(fh for _, fh in frames) + 190
    elif kind == 'desk': width = 1380; height = 1010
    elif kind == 'states': width = 1560; height = 1500
    else: width = 820; height = 1040
    if kind == 'proto':
        body = frames[0][0]
    else:
        fr = ','.join(frames_expr for frames_expr, _ in frames)
        if kind == 'dark':
            fr = ','.join(e.replace(')', ',{theme:\'dark\'})', 1) if '{' not in e else e for e, _ in frames)
            fr = "h(AM.PhoneFrame,{theme:'dark',label:'Task list · dark',nav:'Tasks',fab:h(AM.QuickAdd,{label:'Add task'})},h(AM.TopBar,{title:'Tasks',large:true}),h('div',{className:'am-pad am-col',style:{gap:12}},h(AM.TextField,{placeholder:'Search tasks or ID',icon:'Search'}),h('div',{className:'am-list'},AM.Data.TASKS.slice(0,4).map(t=>h(AM.Screens.TaskRow,{key:t.code,t:t}))),h(AM.Banner,{tone:'waiting',title:'2 changes waiting to send.',action:'Send now'}))),h(AM.PhoneFrame,{theme:'dark',label:'Home cards · dark',nav:'Home'},h('div',{className:'am-pad am-col',style:{gap:14,paddingTop:8}},h(AM.Card,{title:'Planning progress',icon:'ChartPie'},h(AM.ProgressBar,{value:72,label:'Engagement',detail:'18 of 25'})),h(AM.Screens.EventCard,{e:AM.Data.EVENTS[0],wide:true}),h(AM.Toast,{tone:'success'},'Family added.'),h(AM.UndoBar,null,'Done: “Order 20 mehndi cones”')))"
        body = f"h(AM.FrameRow,{{title:{json.dumps(title)},note:{json.dumps(note)}}},{fr})"
    write(f"{comp}/{folder}/preview.html", f'<!-- @dsCard group="{group}" page height={height} width={width} subtitle={json.dumps(title)} -->\n<div id="root"></div>\n<script>{HELP}\nReactDOM.createRoot(document.getElementById("root")).render({body});</script>\n')
print(len(names), 'components,', len(P), 'pages')
