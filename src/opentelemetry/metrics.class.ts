import { Counter, Meter, UpDownCounter, metrics } from '@opentelemetry/api'

const METRICS_CONSUMER: string = 'metrics_consumer'
export class MetricsController {

	meter: Meter

	gaugeMap: Map<string, UpDownCounter>

	sumCounterMap: Map<string, Counter>

	static instance: MetricsController = null

	constructor() {
		this.meter = metrics.getMeter('default')
		this.gaugeMap = new Map<string, UpDownCounter>()
		this.sumCounterMap = new Map<string, Counter>()
	}

	static getInstance() {
		if (!this.instance) {
			this.instance = new MetricsController();
		}
		return this.instance
	}

	recordMetric(name: string, value: number) {
		this.getOTELGauge(name).add(value)
	}

	incrementMetric(name: string, value: number = 1) {
		this.getOTELSumCounter(name).add(value)
	}

	getOTELGauge(name: string, description?: string) {
		if (!this.gaugeMap.has(name)) {
			const counter = this.meter.createUpDownCounter(name, { description: description ?? 'Gauge' })
			this.gaugeMap.set(name, counter)
		}
		return this.gaugeMap.get(name)
	}

	getOTELSumCounter(name: string, description?: string) {
		if (!this.sumCounterMap.has(name)) {
			const counter = this.meter.createCounter(name, { description: description ?? 'Counter' })
			this.sumCounterMap.set(name, counter)
		}
		return this.sumCounterMap.get(name)
	}
}
