/**
 * Copyright 2017 Plexus Interop Deutsche Bank AG
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
namespace Plexus.Interop.Broker.Host
{
    using Plexus.Host;
    using System.Threading;
    using System.Threading.Tasks;

    public sealed class Program : IProgram
    {
        private static readonly ILogger Log = LogManager.GetLogger<Program>();

        private int _stopped;
        private IBroker _broker;

        public async Task<Task> StartAsync(string[] args)
        {
            var brokerArgs = BrokerArguments.Parse(args);
            _broker = BrokerFactory.Instance.Create(brokerArgs.MetadataDir);
            if (_stopped == 1)
            {
                return Task.FromResult(0);
            }
            await _broker.StartAsync().ConfigureAwait(false);
            Log.Debug("Broker process started");
            return _broker.Completion;
        }

        public async Task ShutdownAsync()
        {
            if (Interlocked.Exchange(ref _stopped, 1) == 0 && _broker != null)
            {
                Log.Debug("Shutting down");
                _broker.Stop();
                await _broker.Completion.ConfigureAwait(false);
            }
        }
    }
}