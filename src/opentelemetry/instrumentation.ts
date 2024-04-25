/* instrumentation.ts */
import { NodeSDK } from '@opentelemetry/sdk-node'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { AwsInstrumentation, AwsSdkRequestHookInformation } from '@opentelemetry/instrumentation-aws-sdk'
import { TraceState } from '@opentelemetry/core'
import { Span } from '@opentelemetry/api'
import { RunTimeInstrumentation } from './runTimeMetric.class'
import {
	MetricReader,
	PeriodicExportingMetricReader,
	PushMetricExporter,
	AggregationTemporality
} from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'

const awsInstrumentationConfig = {
	preRequestHook: (span: Span, requestInfo: AwsSdkRequestHookInformation) => {
		if (requestInfo.request.serviceName == 'SQS') {
			span.spanContext().traceState = new TraceState('c=d')
		}
	},
}

const metricsExporter: PushMetricExporter = new OTLPMetricExporter({
	url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
	headers: { service: process.env.OTEL_SERVICE_NAME },
	keepAlive: true,
	temporalityPreference: AggregationTemporality.DELTA
})

const metricReader: MetricReader = new PeriodicExportingMetricReader({
	exporter: metricsExporter,
	exportIntervalMillis: 5000,
})

const sdk = new NodeSDK({
	metricReader: metricReader,
	resource: new Resource({
		[SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME,
		[SemanticResourceAttributes.SERVICE_VERSION]: '1.0',
	}),
	traceExporter: new OTLPTraceExporter({
		url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
		headers: {},
		keepAlive: true,
	}),
	instrumentations: [getNodeAutoInstrumentations(), new AwsInstrumentation(awsInstrumentationConfig), new RunTimeInstrumentation()],
})

sdk.start()
