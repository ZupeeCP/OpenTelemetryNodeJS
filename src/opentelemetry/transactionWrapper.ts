import opentelemetry, { SpanStatusCode } from '@opentelemetry/api'
import * as moment from 'moment'
import { ErrorContoller } from './errorPublisher.class'

export interface ITransactionWrapperResult<T> {
	trError?: Error
	trResult?: T
}

export const bgTransactionWrapper = async <T>(
	name: string,
	group: string,
	handle: () => Promise<T>,
): Promise<{ trError?: Error; trResult?: T }> => {
	const response: ITransactionWrapperResult<T> = {
		trResult: null,
		trError: null,
	}
	try {
		let result: T
		const tracer = opentelemetry.trace.getTracer('bg_transaction_wrapper')
		tracer.startActiveSpan(name, async (span) => {
			try {
				result = await handle()
				span.setStatus({ code: SpanStatusCode.OK })
			} catch (err) {
				response.trError = err
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: `transactionWrapper error: ${err}`,
				})
				ErrorContoller.getInstance().noticeError(err, {
					level: 'error',
					timestamp: moment().format(),
					name: name,
					group: group,
				})
				throw err
			} finally {
				span.end()
			}
		})
		response.trResult = result
		return response
	} catch (error) {
		response.trError = error
		return response
	}
}

