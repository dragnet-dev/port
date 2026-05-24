import hljs from 'highlight.js/lib/core'
import yaml  from 'highlight.js/lib/languages/yaml'
import sql   from 'highlight.js/lib/languages/sql'
import json  from 'highlight.js/lib/languages/json'
import xml   from 'highlight.js/lib/languages/xml'
import nginx from 'highlight.js/lib/languages/nginx'
import bash  from 'highlight.js/lib/languages/bash'

hljs.registerLanguage('yaml',  yaml)
hljs.registerLanguage('sql',   sql)
hljs.registerLanguage('json',  json)
hljs.registerLanguage('xml',   xml)
hljs.registerLanguage('nginx', nginx)
hljs.registerLanguage('bash',  bash)

window.hljs = hljs
