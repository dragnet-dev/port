import type { Env, HaulIndex } from './types'

// Fixed entry point — always fetch this first to resolve all other base URLs.
export const HAUL_INDEX_URL = "https://raw.githubusercontent.com/dragnet-dev/haul/main/index.json"

// Maps our internal platform ID to the satellite repo key used in the haul index.
export function platformToSatelliteKey(platformId: string): string {
    if (platformId === 'crowdstrike_ioc') return 'rules-crowdstrike'
    return `rules-${platformId}`
}

// Priority: cdn (when HAUL_CDN_BASE is set) > raw. Returns '' when key is absent.
export function resolveBase(index: HaulIndex, key: string, env: Env): string {
    if (env.HAUL_CDN_BASE && index.cdn?.[key]) return index.cdn[key].replace(/\/$/, '')
    return (index.raw[key] ?? '').replace(/\/$/, '')
}

export function getTurnstileSiteKey(env: Env): string {
    return env.TURNSTILE_SITE_KEY
}

// Human-readable display names for source IDs used across the intelligence
// corpus. Used by confidenceBar (IOC-level attribution) and normalizeIncident
// (incident-level source chips). Unknown IDs fall back to the raw ID with
// underscores replaced by spaces.
export const SOURCE_DISPLAY_NAME: Record<string, string> = {
    'aikido':          'Aikido',
    'cisa':            'CISA',
    'dfir_report':     'The DFIR Report',
    'elastic_labs':    'Elastic Labs',
    'eset':            'ESET Research',
    'ghsa':            'GitHub Advisory',
    'malware_bazaar':  'MalwareBazaar',
    'nvd':             'NVD',
    'osv':             'OSV',
    'ossf':            'OSSF',
    'ransomware_live': 'Ransomware.live',
    'sekoia':          'Sekoia TDR',
    'snyk':            'Snyk',
    'sonatype':        'Sonatype',
    'stepsecurity':    'StepSecurity',
    'talos':           'Cisco Talos',
    'trivy_db':        'Trivy DB',
    'urlhaus':         'URLhaus',
    'wiz':             'Wiz',
}

export interface Module {
    id:          string
    name:        string
    description: string
    live:        boolean
    colour:      string
    icon:        string
}

export const MODULES: Module[] = [
    {
        id:          "supply",
        name:        "Supply Chain",
        description: "Compromised packages, typosquats, CI/CD poisoning across npm, PyPI, cargo, Maven, NuGet and more.",
        live:        true,
        colour:      "#f85149",
        icon:        "📦",
    },
    {
        id:          "malware",
        name:        "Malware",
        description: "Curated malware family intelligence from leading research teams. IOCs, TTPs, and hunting rules per family.",
        live:        true,
        colour:      "#e3b341",
        icon:        "🦠",
    },
    {
        id:          "ransomware",
        name:        "Ransomware",
        description: "Active ransomware group infrastructure and pre-encryption stage detections.",
        live:        true,
        colour:      "#d29922",
        icon:        "🔒",
    },
    {
        id:          "cve",
        name:        "Exploited CVEs",
        description: "Actively exploited CVEs with detection rules sourced from CISA KEV and corroborating research.",
        live:        true,
        colour:      "#f85149",
        icon:        "⚠️",
    },
    {
        id:          "container",
        name:        "Containers",
        description: "Vulnerable and end-of-life base images across Docker Hub official images and popular registries.",
        live:        true,
        colour:      "#58a6ff",
        icon:        "🐳",
    },
]

export interface Platform {
    id:      string
    name:    string
    ext:     string
    lang:    string
    special: string | null
}

export const PLATFORMS: Platform[] = [
    { id: "sentinel",        name: "Microsoft Sentinel",       ext: "yaml",  lang: "yaml",  special: null       },
    { id: "kql",             name: "KQL / Microsoft Defender", ext: "kql",   lang: "sql",   special: null       },
    { id: "splunk",          name: "Splunk SPL",               ext: "spl",   lang: "sql",   special: null       },
    { id: "elastic",         name: "Elastic SIEM",             ext: "eql",   lang: "sql",   special: null       },
    { id: "wazuh",           name: "Wazuh",                    ext: "xml",   lang: "xml",   special: null       },
    { id: "crowdstrike",     name: "CrowdStrike LogScale",     ext: "lqs",   lang: "sql",   special: null       },
    { id: "crowdstrike_ioc", name: "CrowdStrike Falcon IOC",   ext: "json",  lang: "json",  special: "cs_ioc"   },
    { id: "chronicle",       name: "Google Chronicle",         ext: "yaral", lang: "yaml",  special: null       },
    { id: "suricata",        name: "Suricata",                 ext: "rules", lang: "nginx", special: null       },
    { id: "snort",           name: "Snort",                    ext: "rules", lang: "nginx", special: null       },
    { id: "qradar",          name: "IBM QRadar",               ext: "aql",   lang: "sql",   special: null       },
    { id: "datadog",         name: "Datadog",                  ext: "json",  lang: "json",  special: null       },
    { id: "sigma",           name: "Sigma (universal)",        ext: "yaml",  lang: "yaml",  special: null       },
]
