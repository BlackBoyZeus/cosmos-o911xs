{{/*
Expand the name of the chart.
*/}}
{{- define "cosmos.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "cosmos.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "cosmos.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/}}
{{- define "cosmos.labels" -}}
helm.sh/chart: {{ include "cosmos.chart" . }}
{{ include "cosmos.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.Version | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: cosmos-wfm
app.kubernetes.io/component: {{ .Values.component | default "platform" }}
environment: {{ .Values.environment | default "production" }}
{{- end -}}

{{/*
Selector labels
*/}}
{{- define "cosmos.selectorLabels" -}}
app.kubernetes.io/name: {{ include "cosmos.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Create the name of the service account to use
*/}}
{{- define "cosmos.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
    {{- if .Values.serviceAccount.name -}}
        {{- .Values.serviceAccount.name -}}
    {{- else -}}
        {{- include "cosmos.fullname" . -}}-sa
    {{- end -}}
{{- else -}}
    {{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Create a default fully qualified data volume name.
*/}}
{{- define "cosmos.dataVolumeName" -}}
{{- printf "%s-data" (include "cosmos.fullname" .) -}}
{{- end -}}

{{/*
Create a default fully qualified model volume name.
*/}}
{{- define "cosmos.modelVolumeName" -}}
{{- printf "%s-models" (include "cosmos.fullname" .) -}}
{{- end -}}

{{/*
Create a default fully qualified cache volume name.
*/}}
{{- define "cosmos.cacheVolumeName" -}}
{{- printf "%s-cache" (include "cosmos.fullname" .) -}}
{{- end -}}

{{/*
Define GPU configuration annotations
*/}}
{{- define "cosmos.gpuAnnotations" -}}
{{- if .Values.gpu.enabled -}}
nvidia.com/gpu-feature-discovery: "true"
nvidia.com/gpu-memory: {{ .Values.gpu.memory | default "16Gi" | quote }}
nvidia.com/gpu-count: {{ .Values.gpu.count | default "1" | quote }}
{{- end -}}
{{- end -}}

{{/*
Define security context for containers
*/}}
{{- define "cosmos.securityContext" -}}
runAsNonRoot: true
runAsUser: 1000
runAsGroup: 1000
fsGroup: 1000
allowPrivilegeEscalation: false
capabilities:
  drop:
  - ALL
{{- end -}}

{{/*
Define resource request/limit helpers
*/}}
{{- define "cosmos.resources" -}}
{{- if .Values.resources -}}
resources:
  {{- toYaml .Values.resources | nindent 2 }}
{{- else -}}
resources:
  requests:
    cpu: 1
    memory: 2Gi
  limits:
    cpu: 2
    memory: 4Gi
{{- end -}}
{{- end -}}