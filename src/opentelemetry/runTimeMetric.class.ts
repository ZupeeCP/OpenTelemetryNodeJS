import {
	BatchObservableResult,
	Histogram,
	Observable,
	ObservableCounter,
	ObservableGauge,
} from '@opentelemetry/api'
import * as Prometheus from 'prom-client'
import { PerformanceEntry, PerformanceObserver, constants } from 'perf_hooks'
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

const NODEJS_GC_DURATION_SECONDS = 'nodejs_gc_duration_seconds'

export class RunTimeInstrumentation extends InstrumentationBase {
	static instance: RunTimeInstrumentation

	registry: Prometheus.Registry

	private metricMap: Map<string, Observable>

	private enabled: boolean

	constructor(config: InstrumentationConfig = {}) {
		super('@opentelemetry/instrumentation-node-run-time', '1.0', config);
	}

	init() {
		// Not instrumenting or patching a Node.js module
	}

	override _updateMetricInstruments() {
		this.metricMap = new Map<string, Observable>()
		this.registry = new Prometheus.Registry()
		this.registry.setContentType(
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			Prometheus.openMetricsContentType,
		)
		Prometheus.collectDefaultMetrics({ register: this.registry })
		this.registry.removeSingleMetric(NODEJS_GC_DURATION_SECONDS)
		this.createOtelObservers()
	}

	override enable() {
		this.enabled = true
	}

	override disable() {
		this.enabled = false
	}

	private createOtelObservers() {
		const metrics: Prometheus.MetricObject[] = this.registry.getMetricsAsArray()
		for (const metric of metrics) {
			switch (metric?.type?.toString()) {
				case 'counter':
					this.handleCounter(metric)
					break
				case 'gauge':
					this.handleGuage(metric)
					break
				default:
					// eslint-disable-next-line no-console
					console.log(`Not supported name: ${metric.name} type: ${metric?.type?.toString()}`)
			}
		}
		this.collectGC()
		this.meter.addBatchObservableCallback(
			async (observableResult: BatchObservableResult) => {
				await this.batchObservableCallback(observableResult)
			},
			[...this.metricMap.values()],
		)
	}

	async batchObservableCallback(observableResult: BatchObservableResult) {
		if (!this.enabled) {
			return
		}
		const metrics: Prometheus.MetricObjectWithValues<Prometheus.MetricValue<string>>[] =
			await this.registry.getMetricsAsJSON()
		this.registry.resetMetrics()
		for (const [metricName, observableMetric] of this.metricMap.entries()) {
			const metric: Prometheus.MetricObjectWithValues<Prometheus.MetricValue<string>> = metrics.find(
				(metric) => metric.name === metricName,
			)
			for (const metricValue of metric.values || []) {
				const { value, labels = {} } = metricValue
				observableResult.observe(observableMetric, value, labels)
			}
		}
	}

	handleCounter(metric: Prometheus.MetricObject) {
		const counter: ObservableCounter = this.meter.createObservableCounter(this.getMetricName(metric.name), {
			description: metric.help,
		})
		this.metricMap.set(metric.name, counter)
	}

	handleGuage(metric: Prometheus.MetricObject) {
		const gauge: ObservableGauge = this.meter.createObservableGauge(this.getMetricName(metric.name), {
			description: metric.help,
		})
		this.metricMap.set(metric.name, gauge)
	}

	collectGC() {
		const histogram: Histogram = this.meter.createHistogram(NODEJS_GC_DURATION_SECONDS, {
			description: 'Garbage collection duration by kind, one of major, minor, incremental or weakcb.',
		})
		const labels = {}
		const kinds = {
			[constants.NODE_PERFORMANCE_GC_MAJOR]: { ...labels, kind: 'major' },
			[constants.NODE_PERFORMANCE_GC_MINOR]: { ...labels, kind: 'minor' },
			[constants.NODE_PERFORMANCE_GC_INCREMENTAL]: { ...labels, kind: 'incremental' },
			[constants.NODE_PERFORMANCE_GC_WEAKCB]: { ...labels, kind: 'weakcb' },
		}
		const obs = new PerformanceObserver((list) => {
			if (!this.enabled) {
				return
			}
			const entry: PerformanceEntry = list.getEntries()[0]
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			const kind: number = entry.detail ? entry.detail.kind : entry.kind
			// Convert duration from milliseconds to seconds
			histogram.record(entry.duration / 1000, kinds[kind])
		})
		obs.observe({ entryTypes: ['gc'] })
	}

	private getMetricName(metricName: string) {
		if (metricName.startsWith('nodejs_')) {
			return metricName
		}
		return `nodejs_${metricName}`
	}
}
