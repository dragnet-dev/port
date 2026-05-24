export interface Env {
    CACHE:              KVNamespace
    HAUL_CDN_BASE?:     string  // when set, the haul index will carry a cdn map; those URLs take priority
    SITE_URL:           string
    TURNSTILE_SITE_KEY: string
    TURNSTILE_SECRET:   string
    // ASSETS is provided automatically by Cloudflare Pages for projects with
    // a _worker.js. Used in app.notFound to delegate to static files (e.g.
    // robots.txt, sitemap.xml, /assets/*) before falling back to the 404 page.
    ASSETS:             { fetch: (req: Request) => Promise<Response> }
}

// HaulIndex mirrors the orchestrator index at dragnet-dev/haul/main/index.json.
// Fetched once per cron cycle (or per cold-start) and cached at _haul:index.
export interface HaulIndex {
    $schema_version: string
    generated:       string
    repos:           Record<string, string>  // "intel" | "rules-sigma" | ... → GitHub URL
    raw:             Record<string, string>  // same keys → raw base URL
    cdn?:            Record<string, string>  // present only when HAUL_CDN_BASE is active
    manifest_url:    string
}

export interface IOC {
    type:       string
    value:      string
    confidence: number
    sources:    string[]
    context?:   string
}

export interface Rule {
    id:          string
    label:       string
    description: string
    layer:       string
    platforms:   string[]
    mitre?:      string[]
}

export interface BehaviourDetection {
    id:          string
    title:       string
    description: string
    tags:        string[]
    platforms:   string[]
    files:       BehaviourFile[]
}

export interface BehaviourFile {
    platform: string
    layer:    string
    file:     string
}

export interface MitreTechnique {
    id:     string
    name:   string
    tactic: string
}

export interface AffectedPackage {
    name:          string
    ecosystem:     string
    versions:      string[]
    safe_version?: string
    safe_digest?:  string
}

export interface ModelIndicator {
    type:         string
    description?: string
}

export interface ExposureData {
    lockfile_signatures?:  string[]
    compromise_files?:     string[]
    ide_artefacts?:        string[]
    install_hooks?:        string[]
}

export interface Incident {
    id:               string
    module:           string
    ecosystem:        string
    severity:         'critical' | 'high' | 'medium' | 'low'
    attack_type:      string
    description?:     string
    campaign?:        string
    actor?:           string
    published:        string
    compromise_start?: string
    compromise_end?:   string
    confidence:       number
    source_count:     number
    sources:          IncidentSource[]
    packages:         AffectedPackage[]
    iocs:             IOC[]
    behaviours:       BehaviourDetection[]
    mitre_techniques: MitreTechnique[]
    exposure?:         ExposureData
    model_indicators?: ModelIndicator[]
    references:        string[]
    summary?:          string
    // Domain-specific extension blocks — at most one is populated, keyed off the
    // incident's source module. Mirrors dragnet's incident.Incident substructs.
    container_ext?:    ContainerExtension
    cve_ext?:          CVEExtension
    malware_ext?:      MalwareExtension
}

export interface IncidentSource {
    name: string
    url:  string
}

// IncidentSummary mirrors dragnet/internal/index/generator.go:IncidentSummary.
// `module` is added by port at fetch time (see routes/home.ts) — dragnet itself
// only emits the module name at the index level, not on each incident.
export interface IncidentSummary {
    id:                    string
    module?:               string
    packages?:             string[]
    ecosystem?:            string
    severity:              'critical' | 'high' | 'medium' | 'low'
    attack_type:           string
    campaign?:             string
    actor?:                string
    published?:            string
    ioc_count:             number
    source_count:          number
    sources?:              string[]
    cross_domain?:         boolean
    cross_domain_modules?: string[]
    iocs?:                 { type: string; value: string; confidence?: number }[]
    impact?: {
        total_weekly_downloads?: number
        overall_impact_rating?:  string
        top_package_downloads?:  number
    }
    typosquat_target?: {
        package:          string
        weekly_downloads: number
        impact_rating:    string
    }
}

// SearchRecord mirrors dragnet/internal/index/search.go:SearchRecord —
// the per-incident row written to feeds/search-{module}.jsonl. Smaller than
// a full Incident; sufficient to render a search result card.
export interface SearchRecord {
    id:           string
    module:       string
    summary?:     string
    severity?:    'critical' | 'high' | 'medium' | 'low'
    published?:   string
    ecosystems?:  string[]
    tags?:        string[]
    actors?:      string[]
    packages?:    { ecosystem: string, name: string }[]
    cve_ids?:     string[]
}

// Manifest mirrors dragnet/internal/manifest/manifest.go:Manifest —
// the deterministic per-file inventory written to feeds/manifest.json.
// Used by port's scheduled handler to invalidate KV cache entries when
// haul ships an update.
export interface Manifest {
    dragnet_version: string
    files:           ManifestFile[]
}

export interface ManifestFile {
    path:    string
    records?: number
    bytes:   number
    sha256:  string
}

// CampaignSummary mirrors dragnet/internal/index/generator.go:CampaignSummary.
export interface CampaignSummary {
    name:         string
    actor?:       string
    confidence?:  string
    incident_ids: string[]
    first_seen?:  string
    last_seen?:   string
    active:       boolean
}

// ModuleIndexStats mirrors dragnet/internal/index/generator.go:ModuleIndexStats.
export interface ModuleIndexStats {
    total_incidents: number
    total_iocs:      number
    last_sync:       string
}

// IncidentIndex mirrors dragnet/internal/index/generator.go:ModuleIndex
// (the {module}/incidents/index.json file).
export interface IncidentIndex {
    generated: string
    module:    string
    stats:     ModuleIndexStats
    campaigns?: CampaignSummary[]
    incidents: IncidentSummary[]
}

// RootModuleStats mirrors the per-module entry in RootIndex.stats.
// dragnet emits `stats: { supply: {...}, malware: {...}, ..., total: {...} }`.
export interface RootModuleStats {
    incidents: number
    iocs:      number
}

// RootCrossDomainIncident mirrors dragnet's CrossDomainIncident.
export interface RootCrossDomainIncident {
    modules:      string[]
    shared_ioc?:  string
    actor?:       string
    incident_ids: string[]
    confidence:   number
}

// RootRecentEntry mirrors dragnet's RecentEntry.
export interface RootRecentEntry {
    module:       string
    id:           string
    severity:     string
    summary:      string
    published?:   string
    cross_domain?: boolean
}

// RootIndex mirrors dragnet/internal/index/generator.go:RootIndex
// (the root incidents/index.json file).
export interface RootIndex {
    generated:                string
    stats:                    Record<string, RootModuleStats>
    cross_domain_incidents?:  RootCrossDomainIncident[]
    recent?:                  RootRecentEntry[]
}

// ThreatActor mirrors dragnet/internal/actor/store.go — the YAML written to
// actors/profiles/{id}.yaml is sourced from the MITRE ATT&CK bundle, so the
// available fields are MITRE-native (mitre_id, type, ttps, software) rather
// than the richer threat-intel shape we used pre-MITRE.
export interface ThreatActor {
    id:           string
    name:         string
    mitre_id?:    string
    aliases?:     string[]
    type?:        string
    description?: string
    ttps?:        ActorTechnique[]
    software?:    string[]
    confidence?:  'high' | 'medium' | 'low'
}

export interface ActorTechnique {
    id:   string
    name: string
}

// AffectedImage mirrors dragnet/internal/incident/schema.go:AffectedImage —
// the per-image-tag row inside a CVE-centric container incident. One incident
// covers one CVE; AffectedImages is the list of registry repos hit by that CVE.
export interface AffectedImage {
    repository:       string
    os_family?:       string
    vulnerable_tags:  string[]
    fixed_tag?:       string
    cve_ids?:         string[]
    confidence?:      number
    sources?:         string[]
}

// EOLImageInfo mirrors dragnet/internal/incident/schema.go:EOLImageInfo —
// emitted for incidents sourced from endoflife.date.
export interface EOLImageInfo {
    repository:   string
    cycle:        string
    eol_date:     string
    replacement?: string
}

// ContainerExtension mirrors dragnet/internal/incident/schema.go:
// ContainerExtension — the container-module extension block on an Incident.
export interface ContainerExtension {
    affected_images?:   AffectedImage[]
    eol_images?:        EOLImageInfo[]
    cvss_score?:        number
    exploited_in_wild?: boolean
    public_poc?:        boolean
    tier?:              number   // 1=KEV, 2=CVSS≥9, 3=CVSS≥7+PoC, 4=informational
}

// CVEExtension mirrors dragnet/internal/incident/schema.go:CVEExtension.
export interface CVEExtension {
    cve_id:       string
    cvss_score?:  number
    cvss_vector?: string
}

// MalwareExtension carries malware-family metadata from the malware module.
export interface MalwareExtension {
    malware_family?: string
    malware_type?:   string
    platforms?:      string[]
}
