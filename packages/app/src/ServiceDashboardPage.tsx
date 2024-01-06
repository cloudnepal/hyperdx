import * as React from 'react';
import Head from 'next/head';
import { StringParam, useQueryParam, withDefault } from 'use-query-params';
import { Card, Grid, Group, Select, Tabs } from '@mantine/core';

import AppNav from './AppNav';
import {
  convertDateRangeToGranularityString,
  ERROR_RATE_PERCENTAGE_NUMBER_FORMAT,
  INTEGER_NUMBER_FORMAT,
  MS_NUMBER_FORMAT,
} from './ChartUtils';
import {
  K8S_CPU_PERCENTAGE_NUMBER_FORMAT,
  K8S_MEM_NUMBER_FORMAT,
} from './ChartUtils';
import EndpointLatencyTile from './EndpointLatencyTile';
import HDXLineChart from './HDXLineChart';
import HDXListBarChart from './HDXListBarChart';
import HDXMultiSeriesTableChart from './HDXMultiSeriesTableChart';
import HDXMultiSeriesLineChart from './HDXMultiSeriesTimeChart';
import { LogTableWithSidePanel } from './LogTableWithSidePanel';
import SearchInput from './SearchInput';
import SearchTimeRangePicker from './SearchTimeRangePicker';
import { parseTimeQuery, useTimeQuery } from './timeQuery';

const defaultTimeRange = parseTimeQuery('Past 1h', false);

type MockService = {
  value: string;
  label: string;
  podNames?: string[];
};

const MOCK_SERVICES: MockService[] = [
  {
    value: 'kube-apiserver',
    label: 'kube-apiserver',
    podNames: ['kube-apiserver-docker-desktop'],
  },
  {
    value: 'otel-collector-daemonset-opentelemetry-collector',
    label: 'otel-collector-daemonset-opentelemetry-collector',
    podNames: [
      'otel-collector-daemonset-opentelemetry-collector-57bd688cbjkxsl',
    ],
  },
  { value: 'etcd', label: 'etcd', podNames: ['etcd-docker-desktop'] },
  {
    value: 'kube-controller-manager',
    label: 'kube-controller-manager',
    podNames: ['kube-controller-manager-docker-desktop'],
  },
  {
    value: 'kube-scheduler',
    label: 'kube-scheduler',
    podNames: ['kube-scheduler-docker-desktop'],
  },
  {
    value: 'coredns',
    label: 'coredns',
    podNames: ['coredns-5dd5756b68-tmpcp', 'coredns-5dd5756b68-wngm5'],
  },
  { value: 'kube', label: 'kube', podNames: ['kube-proxy-9hbxm'] },
];

const CHART_HEIGHT = 300;

export default function ServiceDashboardPage() {
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const [_searchQuery, _setSearchQuery] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useQueryParam(
    'q',
    withDefault(StringParam, ''),
    { updateType: 'replaceIn' },
  );

  const [service, setService] = useQueryParam(
    'service',
    withDefault(StringParam, ''),
    { updateType: 'replaceIn' },
  );

  const podNames = React.useMemo(() => {
    return MOCK_SERVICES.find(s => s.value === service)?.podNames ?? [];
  }, [service]);

  const onSearchSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSearchQuery(_searchQuery || null);
    },
    [_searchQuery, setSearchQuery],
  );

  const {
    searchedTimeRange: dateRange,
    displayedTimeInputValue,
    setDisplayedTimeInputValue,
    onSearch,
  } = useTimeQuery({
    isUTC: false,
    defaultValue: 'Past 1h',
    defaultTimeRange: [
      defaultTimeRange?.[0]?.getTime() ?? -1,
      defaultTimeRange?.[1]?.getTime() ?? -1,
    ],
  });

  // Generate chart config
  const whereClause = React.useMemo(() => {
    return [
      podNames.map(podName => `k8s.pod.name:"${podName}"`).join(' OR ') ||
        'k8s.pod.name:*',
      searchQuery,
    ].join(' ');
  }, [podNames, searchQuery]);

  const scopeWhereQuery = React.useCallback(
    (where: string) => {
      const serviceQuery = service ? `service:${service} ` : '';
      const sQuery = searchQuery ? `(${searchQuery}) ` : '';
      const whereQuery = where ? `(${where})` : '';
      return `${serviceQuery}${sQuery}${whereQuery}`;
    },
    [service, searchQuery],
  );

  return (
    <div>
      <Head>
        <title>Service Dashboard - HyperDX</title>
      </Head>
      <div className="d-flex">
        <AppNav fixed />
        <div className="w-100">
          <div className="d-flex flex-column">
            <Group
              px="md"
              py="xs"
              className="border-bottom border-dark"
              spacing="xs"
              align="center"
            >
              {/* Use Autocomplete instead? */}
              <Select
                searchable
                clearable
                allowDeselect
                placeholder="All Services"
                maxDropdownHeight={280}
                data={MOCK_SERVICES}
                radius="md"
                variant="filled"
                value={service}
                onChange={v => setService(v)}
                w={300}
              />
              <div style={{ flex: 1 }}>
                <form onSubmit={onSearchSubmit}>
                  <SearchInput
                    inputRef={searchInputRef}
                    placeholder="Scope dashboard to..."
                    value={_searchQuery ?? searchQuery}
                    onChange={v => _setSearchQuery(v)}
                    onSearch={() => {}}
                    showHotkey={false}
                  />
                </form>
              </div>
              <div className="d-flex" style={{ width: 350, height: 36 }}>
                <SearchTimeRangePicker
                  inputValue={displayedTimeInputValue}
                  setInputValue={setDisplayedTimeInputValue}
                  onSearch={range => {
                    onSearch(range);
                  }}
                />
              </div>
            </Group>
          </div>
          <Tabs
            color="gray"
            variant="pills"
            defaultValue="infrastructure"
            radius="md"
          >
            <div className="px-3 py-2 border-bottom border-dark">
              <Tabs.List>
                <Tabs.Tab value="infrastructure">Infrastructure</Tabs.Tab>
                <Tabs.Tab value="http">HTTP Service</Tabs.Tab>
                <Tabs.Tab value="database">Database</Tabs.Tab>
              </Tabs.List>
            </div>

            <div className="p-3">
              <Tabs.Panel value="infrastructure">
                <Grid>
                  <Grid.Col span={6}>
                    <Card p="md">
                      <Card.Section p="md" py="xs" withBorder>
                        CPU Usage
                      </Card.Section>
                      <Card.Section p="md" py="sm" h={CHART_HEIGHT}>
                        <HDXLineChart
                          config={{
                            dateRange,
                            granularity: convertDateRangeToGranularityString(
                              dateRange,
                              60,
                            ),
                            groupBy: 'k8s.pod.name',
                            where: whereClause,
                            table: 'metrics',
                            aggFn: 'avg',
                            field: 'k8s.pod.cpu.utilization - Gauge',
                            numberFormat: K8S_CPU_PERCENTAGE_NUMBER_FORMAT,
                          }}
                        />
                      </Card.Section>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Card p="md">
                      <Card.Section p="md" py="xs" withBorder>
                        Memory Usage
                      </Card.Section>
                      <Card.Section p="md" py="sm" h={CHART_HEIGHT}>
                        <HDXLineChart
                          config={{
                            dateRange,
                            granularity: convertDateRangeToGranularityString(
                              dateRange,
                              60,
                            ),
                            groupBy: 'k8s.pod.name',
                            where: whereClause,
                            table: 'metrics',
                            aggFn: 'avg',
                            field: 'k8s.pod.memory.usage - Gauge',
                            numberFormat: K8S_MEM_NUMBER_FORMAT,
                          }}
                        />
                      </Card.Section>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Card p="md">
                      <Card.Section p="md" py="xs" withBorder>
                        Latest Kubernetes Error Events
                      </Card.Section>
                      <Card.Section p="md" py="sm" h={CHART_HEIGHT}>
                        <LogTableWithSidePanel
                          config={{
                            dateRange,
                            where: whereClause + ' level:error',
                          }}
                          isLive={false}
                          isUTC={false}
                          setIsUTC={() => {}}
                          onPropertySearchClick={() => {}}
                        />{' '}
                      </Card.Section>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Card p="md">
                      <Card.Section p="md" py="xs" withBorder>
                        Debug
                      </Card.Section>
                      <Card.Section p="md" py="sm">
                        <pre>
                          {JSON.stringify(
                            {
                              dateRange,
                              searchQuery,
                              service,
                              podNames,
                              whereClause,
                            },
                            null,
                            4,
                          )}
                        </pre>
                      </Card.Section>
                    </Card>
                  </Grid.Col>
                </Grid>
              </Tabs.Panel>
              <Tabs.Panel value="http">
                <Grid>
                  <Grid.Col span={6}>
                    <Card p="md">
                      <Card.Section p="md" py="xs" withBorder>
                        Request Error Rate
                      </Card.Section>
                      <Card.Section p="md" py="sm" h={CHART_HEIGHT}>
                        <HDXMultiSeriesLineChart
                          config={{
                            dateRange,
                            granularity: convertDateRangeToGranularityString(
                              dateRange,
                              60,
                            ),
                            series: [
                              {
                                displayName: 'Error Rate %',
                                table: 'logs',
                                type: 'time',
                                aggFn: 'count',
                                where: scopeWhereQuery(
                                  'span.kind:"server" level:"error"',
                                ),
                                groupBy: [],
                                numberFormat:
                                  ERROR_RATE_PERCENTAGE_NUMBER_FORMAT,
                              },
                              {
                                table: 'logs',
                                type: 'time',
                                aggFn: 'count',
                                field: '',
                                where: scopeWhereQuery('span.kind:"server"'),
                                groupBy: [],
                                numberFormat:
                                  ERROR_RATE_PERCENTAGE_NUMBER_FORMAT,
                              },
                            ],
                            seriesReturnType: 'ratio',
                          }}
                        />
                      </Card.Section>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Card p="md">
                      <Card.Section p="md" py="xs" withBorder>
                        Request Throughput
                      </Card.Section>
                      <Card.Section p="md" py="sm" h={CHART_HEIGHT}>
                        <HDXMultiSeriesLineChart
                          config={{
                            dateRange,
                            granularity: convertDateRangeToGranularityString(
                              dateRange,
                              60,
                            ),
                            series: [
                              {
                                displayName: 'Requests',
                                table: 'logs',
                                type: 'time',
                                aggFn: 'count',
                                where: scopeWhereQuery('span.kind:"server"'),
                                groupBy: [],
                                numberFormat: {
                                  ...INTEGER_NUMBER_FORMAT,
                                  unit: 'requests',
                                },
                              },
                            ],
                            seriesReturnType: 'column',
                          }}
                        />
                      </Card.Section>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Card p="md">
                      <Card.Section p="md" py="xs" withBorder>
                        20 Top Most Time Consuming Endpoints
                      </Card.Section>
                      <Card.Section p="md" py="sm" h={CHART_HEIGHT}>
                        <HDXListBarChart
                          config={{
                            dateRange,
                            granularity: convertDateRangeToGranularityString(
                              dateRange,
                              60,
                            ),
                            series: [
                              {
                                table: 'logs',
                                type: 'time',
                                aggFn: 'sum',
                                field: 'duration',
                                where: scopeWhereQuery('span.kind:"server"'),
                                groupBy: ['span_name'],
                                numberFormat: MS_NUMBER_FORMAT,
                              },
                            ],
                          }}
                        />
                      </Card.Section>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <EndpointLatencyTile
                      dateRange={dateRange}
                      scopeWhereQuery={scopeWhereQuery}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Card p="md">
                      <Card.Section p="md" py="xs" withBorder>
                        Endpoints
                      </Card.Section>
                      <Card.Section p="md" py="sm" h={CHART_HEIGHT}>
                        <HDXMultiSeriesTableChart
                          config={{
                            groupColumnName: 'Endpoint',
                            dateRange,
                            granularity: convertDateRangeToGranularityString(
                              dateRange,
                              60,
                            ),
                            series: [
                              {
                                displayName: 'Throughput',
                                table: 'logs',
                                type: 'table',
                                aggFn: 'count',
                                where: scopeWhereQuery('span.kind:"server"'),
                                groupBy: ['span_name'],
                              },
                              {
                                displayName: 'P95',
                                table: 'logs',
                                type: 'table',
                                aggFn: 'p95',
                                field: 'duration',
                                where: scopeWhereQuery('span.kind:"server"'),
                                groupBy: ['span_name'],
                                numberFormat: {
                                  factor: 1,
                                  output: 'number',
                                  mantissa: 2,
                                  thousandSeparated: true,
                                  average: false,
                                  decimalBytes: false,
                                  unit: 'ms',
                                },
                              },
                              {
                                displayName: 'Median',
                                table: 'logs',
                                type: 'table',
                                aggFn: 'p50',
                                field: 'duration',
                                where: scopeWhereQuery('span.kind:"server"'),
                                groupBy: ['span_name'],
                                numberFormat: {
                                  factor: 1,
                                  output: 'number',
                                  mantissa: 2,
                                  thousandSeparated: true,
                                  average: false,
                                  decimalBytes: false,
                                  unit: 'ms',
                                },
                              },
                              {
                                displayName: 'Total',
                                table: 'logs',
                                type: 'table',
                                aggFn: 'sum',
                                field: 'duration',
                                where: scopeWhereQuery('span.kind:"server"'),
                                groupBy: ['span_name'],
                                sortOrder: 'desc',
                              },
                              {
                                displayName: 'Errors',
                                table: 'logs',
                                type: 'table',
                                aggFn: 'count',
                                field: '',
                                where: scopeWhereQuery(
                                  'span.kind:"server" level:"error"',
                                ),
                                groupBy: ['span_name'],
                              },
                            ],
                            seriesReturnType: 'column',
                          }}
                        />
                      </Card.Section>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Card p="md">
                      <Card.Section p="md" py="xs" withBorder>
                        Debug
                      </Card.Section>
                      <Card.Section p="md" py="sm">
                        <pre>
                          {JSON.stringify(
                            {
                              dateRange,
                              searchQuery,
                              service,
                              podNames,
                              whereClause,
                            },
                            null,
                            4,
                          )}
                        </pre>
                      </Card.Section>
                    </Card>
                  </Grid.Col>
                </Grid>
              </Tabs.Panel>
              <Tabs.Panel value="database">Database</Tabs.Panel>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}