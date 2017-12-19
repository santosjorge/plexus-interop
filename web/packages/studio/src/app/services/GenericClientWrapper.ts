import { InteropClient } from "./InteropClient";
import { GenericClientApi, ValueHandler, InvocationClient, MethodDiscoveryRequest, DiscoveredMethod } from "@plexus-interop/client";
import { InvocationRequestInfo } from "@plexus-interop/protocol";
import { MethodDiscoveryResponse, ProvidedMethodReference } from "@plexus-interop/client-api";
import { InteropRegistryService, DynamicMarshallerFactory, ProvidedMethod, ConsumedMethod } from "@plexus-interop/broker";
import { UnaryStringHandler } from "./UnaryStringHandler";
import { DefaultMessageGenerator } from "./DefaultMessageGenerator";

export class GenericClientWrapper implements InteropClient {

    public constructor(
        private readonly appId: string,
        private readonly genericClient: GenericClientApi,
        private readonly interopRegistryService: InteropRegistryService,
        private readonly encoderProvider: DynamicMarshallerFactory,
        private readonly unaryHandlers: Map<string, UnaryStringHandler>,
        private readonly defaultGenerator: DefaultMessageGenerator) {
    }

    public disconnect(): Promise<void> {
        return this.genericClient.disconnect();
    }

    public setUnaryActionHandler(serviceId: string, methodId: string, handler: (requestJson: string) => Promise<string>): void {
        this.unaryHandlers.set(`${serviceId}.${methodId}`, handler);
    }

    public async sendUnaryRequest(methodToInvoke: DiscoveredMethod | ConsumedMethod, requestJson: string, responseHandler: ValueHandler<string>): Promise<InvocationClient> {

        let inputMessageId;
        let outputMessageId;

        if ((methodToInvoke as DiscoveredMethod).providedMethod) {
            const provided = methodToInvoke as DiscoveredMethod;
            inputMessageId = provided.inputMessageId as string;
            outputMessageId = provided.outputMessageId as string;
        } else {
            const consumed = methodToInvoke as ConsumedMethod;
            inputMessageId = consumed.method.inputMessage.id;
            outputMessageId = consumed.method.outputMessage.id;
        }

        const requestEncoder = this.encoderProvider.getMarshaller(inputMessageId);
        const responseEncoder = this.encoderProvider.getMarshaller(outputMessageId);

        const requestData = JSON.parse(requestJson);
        requestEncoder.validate(requestData);

        const internalResponseHandler = {
            value: v => {
                responseHandler.value(JSON.stringify(responseEncoder.decode(v)));
            },
            error: e => {
                responseHandler.error(e);
            }
        };

        if ((methodToInvoke as DiscoveredMethod).providedMethod) {
            const provided = methodToInvoke as DiscoveredMethod;
            return await this.genericClient.sendDiscoveredUnaryRequest(
                provided.providedMethod, 
                requestEncoder.encode(requestData), 
                internalResponseHandler);
        } else {
            const consumed = methodToInvoke as ConsumedMethod;
            inputMessageId = consumed.method.inputMessage.id;
            outputMessageId = consumed.method.outputMessage.id;
            return await this.genericClient.sendUnaryRequest({
                serviceId: consumed.consumedService.service.id,
                methodId: consumed.method.name
            }, requestEncoder.encode(requestData), {
                value: v => {
                    responseHandler.value(JSON.stringify(responseEncoder.decode(v)));
                },
                error: e => {
                    responseHandler.error(e);
                }
            });
        }
    }

    public discoverMethod(discoveryRequest: MethodDiscoveryRequest): Promise<MethodDiscoveryResponse> {
        return this.genericClient.discoverMethod(discoveryRequest)
    }

    public createDefaultPayload(messageId: string): string {
        return this.defaultGenerator.generate(messageId);
    }

}