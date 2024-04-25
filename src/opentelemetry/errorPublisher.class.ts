import { context, trace, SpanStatusCode } from '@opentelemetry/api'

enum ErrorPublisher {
	BOTH = 'BOTH',
	NEWRELIC = 'NEWRELIC',
	OTEL = 'OTEL',
}

const ERROR_PUBLISHER: string = 'error_publisher'

export class ErrorContoller {
	static instance: ErrorContoller = null

	static publisher: ErrorPublisher = ErrorPublisher.BOTH

	constructor() {
	}

	static getInstance() {
		if (!ErrorContoller.instance) {
			this.instance = new ErrorContoller()
		}
		return this.instance
	}

	noticeError(error: Error, customAttributes?: { [key: string]: string | number | boolean }) {
		this.otelNoticeError(error, customAttributes)	
	}

	otelNoticeError(error: Error, customAttributes?: { [key: string]: string | number | boolean }) {
		try {
			const span = trace.getSpan(context.active())
			if (!span) return
			span.recordException(error)
			for (const key in Object.keys(customAttributes)) {
				span.setAttribute(key, customAttributes[key])
			}
			span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
		} catch (error) {
			// ignore error
		}
	}
}
