import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SendIcon from '@mui/icons-material/Send';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  backupProfileApi,
  notificationApi,
  serverApi,
  type NotificationPreference,
  type NotificationPreferenceInput,
} from '../api';
import { NotificationBell } from '../components/common/NotificationBell';
import type { BackupProfile, Server } from '../types';

function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [isSupported, setIsSupported] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [profiles, setProfiles] = useState<BackupProfile[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [sendingTest, setSendingTest] = useState(false);

  // New preference form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPref, setNewPref] = useState<NotificationPreferenceInput>({
    notify_on_start: false,
    notify_on_success: false,
    notify_on_failure: true,
    notify_on_consecutive_failures: true,
    consecutive_failure_threshold: 3,
    notify_on_low_storage: true,
    low_storage_threshold: 10,
  });
  const [newPrefScope, setNewPrefScope] = useState<'global' | 'profile' | 'server'>('global');
  const [selectedProfileId, setSelectedProfileId] = useState<number | ''>('');
  const [selectedServerId, setSelectedServerId] = useState<number | ''>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Check support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setIsSupported(false);
        setLoading(false);
        return;
      }

      setPermission(Notification.permission);

      // Load servers and profiles for the form
      const [serversData, profilesData] = await Promise.all([
        serverApi.list(),
        backupProfileApi.list(),
      ]);
      setServers(serversData);
      setProfiles(profilesData);

      // Check subscription
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          setEndpoint(subscription.endpoint);
          setIsSubscribed(true);
          
          // Load preferences
          const prefs = await notificationApi.getPreferences(subscription.endpoint);
          setPreferences(prefs);
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionChange = async (subscribed: boolean) => {
    setIsSubscribed(subscribed);
    if (subscribed) {
      // Reload to get new endpoint
      setTimeout(loadData, 500);
    } else {
      setPreferences([]);
      setEndpoint(null);
    }
  };

  const handleUpdatePreference = async (pref: NotificationPreference, updates: Partial<NotificationPreferenceInput>) => {
    try {
      const updatedPref = await notificationApi.updatePreference(pref.id, {
        backup_profile_id: pref.backup_profile_id,
        server_id: pref.server_id,
        notify_on_start: updates.notify_on_start ?? pref.notify_on_start,
        notify_on_success: updates.notify_on_success ?? pref.notify_on_success,
        notify_on_failure: updates.notify_on_failure ?? pref.notify_on_failure,
        notify_on_consecutive_failures: updates.notify_on_consecutive_failures ?? pref.notify_on_consecutive_failures,
        consecutive_failure_threshold: updates.consecutive_failure_threshold ?? pref.consecutive_failure_threshold,
        notify_on_low_storage: updates.notify_on_low_storage ?? pref.notify_on_low_storage,
        low_storage_threshold: updates.low_storage_threshold ?? pref.low_storage_threshold,
      });
      
      setPreferences(prefs => prefs.map(p => p.id === pref.id ? { ...p, ...updatedPref } : p));
    } catch (error) {
      console.error('Error updating preference:', error);
    }
  };

  const handleDeletePreference = async (prefId: number) => {
    if (!confirm('Are you sure you want to delete this notification rule?')) return;
    
    try {
      await notificationApi.deletePreference(prefId);
      setPreferences(prefs => prefs.filter(p => p.id !== prefId));
    } catch (error) {
      console.error('Error deleting preference:', error);
    }
  };

  const handleAddPreference = async () => {
    if (!endpoint) return;

    try {
      const prefInput: NotificationPreferenceInput = {
        ...newPref,
        backup_profile_id: newPrefScope === 'profile' && selectedProfileId ? selectedProfileId as number : undefined,
        server_id: newPrefScope === 'server' && selectedServerId ? selectedServerId as number : undefined,
      };

      const created = await notificationApi.createPreference(endpoint, prefInput);
      
      // Reload to get the full preference with relations
      await loadData();
      
      // Reset form
      setShowAddForm(false);
      setNewPref({
        notify_on_start: false,
        notify_on_success: false,
        notify_on_failure: true,
        notify_on_consecutive_failures: true,
        consecutive_failure_threshold: 3,
        notify_on_low_storage: true,
        low_storage_threshold: 10,
      });
      setNewPrefScope('global');
      setSelectedProfileId('');
      setSelectedServerId('');
    } catch (error) {
      console.error('Error creating preference:', error);
    }
  };

  const handleSendTest = async () => {
    if (!endpoint) return;
    
    setSendingTest(true);
    try {
      await notificationApi.sendTest(endpoint);
    } catch (error) {
      console.error('Error sending test notification:', error);
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!isSupported) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Notification Settings
        </Typography>
        <Alert severity="error">
          Push notifications are not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.
        </Alert>
      </Box>
    );
  }

  if (permission === 'denied') {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Notification Settings
        </Typography>
        <Alert severity="warning">
          Notifications are blocked by your browser. Please enable notifications in your browser settings to receive backup alerts.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Notification Settings
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          {isSubscribed && (
            <Button
              variant="outlined"
              startIcon={sendingTest ? <CircularProgress size={16} /> : <SendIcon />}
              onClick={handleSendTest}
              disabled={sendingTest}
            >
              Send Test
            </Button>
          )}
          <NotificationBell
            size="large"
            showLabel
            onStateChange={handleSubscriptionChange}
          />
        </Box>
      </Box>

      {!isSubscribed ? (
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
              <Box>
                <Typography variant="h6">Enable Push Notifications</Typography>
                <Typography color="text.secondary">
                  Click the bell icon above to enable push notifications and receive alerts about your backups.
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            You are subscribed to push notifications. Configure which events trigger notifications below.
          </Alert>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Notification Rules</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddForm(true)}
                  data-testid="add-notification-rule-btn"
                >
                  Add Rule
                </Button>
              </Box>

              {showAddForm && (
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    New Notification Rule
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Scope</InputLabel>
                        <Select
                          value={newPrefScope}
                          label="Scope"
                          onChange={(e) => setNewPrefScope(e.target.value as 'global' | 'profile' | 'server')}
                        >
                          <MenuItem value="global">All Backups (Global)</MenuItem>
                          <MenuItem value="profile">Specific Profile</MenuItem>
                          <MenuItem value="server">Specific Server</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    {newPrefScope === 'profile' && (
                      <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Backup Profile</InputLabel>
                          <Select
                            value={selectedProfileId}
                            label="Backup Profile"
                            onChange={(e) => setSelectedProfileId(e.target.value as number)}
                          >
                            {profiles.map(p => (
                              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}

                    {newPrefScope === 'server' && (
                      <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Server</InputLabel>
                          <Select
                            value={selectedServerId}
                            label="Server"
                            onChange={(e) => setSelectedServerId(e.target.value as number)}
                          >
                            {servers.map(s => (
                              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" gutterBottom>Backup Events</Typography>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={newPref.notify_on_start}
                            onChange={(e) => setNewPref({ ...newPref, notify_on_start: e.target.checked })}
                          />
                        }
                        label="Notify when backup starts"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={newPref.notify_on_success}
                            onChange={(e) => setNewPref({ ...newPref, notify_on_success: e.target.checked })}
                          />
                        }
                        label="Notify on backup success"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={newPref.notify_on_failure}
                            onChange={(e) => setNewPref({ ...newPref, notify_on_failure: e.target.checked })}
                          />
                        }
                        label="Notify on backup failure"
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="subtitle2" gutterBottom>Consecutive Failures</Typography>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={newPref.notify_on_consecutive_failures}
                            onChange={(e) => setNewPref({ ...newPref, notify_on_consecutive_failures: e.target.checked })}
                          />
                        }
                        label="Notify on multiple failures"
                      />
                      {newPref.notify_on_consecutive_failures && (
                        <Box sx={{ px: 2 }}>
                          <Typography variant="body2" gutterBottom>
                            Alert after {newPref.consecutive_failure_threshold} consecutive failures
                          </Typography>
                          <Slider
                            value={newPref.consecutive_failure_threshold}
                            onChange={(_, value) => setNewPref({ ...newPref, consecutive_failure_threshold: value as number })}
                            min={2}
                            max={10}
                            marks
                            valueLabelDisplay="auto"
                          />
                        </Box>
                      )}
                    </Grid>

                    {newPrefScope === 'global' && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" gutterBottom>Storage Alerts</Typography>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={newPref.notify_on_low_storage}
                              onChange={(e) => setNewPref({ ...newPref, notify_on_low_storage: e.target.checked })}
                            />
                          }
                          label="Notify on low storage space"
                        />
                        {newPref.notify_on_low_storage && (
                          <Box sx={{ px: 2, maxWidth: 300 }}>
                            <Typography variant="body2" gutterBottom>
                              Alert when free space falls below {newPref.low_storage_threshold}%
                            </Typography>
                            <Slider
                              value={newPref.low_storage_threshold}
                              onChange={(_, value) => setNewPref({ ...newPref, low_storage_threshold: value as number })}
                              min={5}
                              max={50}
                              step={5}
                              marks
                              valueLabelDisplay="auto"
                            />
                          </Box>
                        )}
                      </Grid>
                    )}
                  </Grid>

                  <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
                    <Button onClick={() => setShowAddForm(false)}>Cancel</Button>
                    <Button
                      variant="contained"
                      onClick={handleAddPreference}
                      disabled={
                        (newPrefScope === 'profile' && !selectedProfileId) ||
                        (newPrefScope === 'server' && !selectedServerId)
                      }
                    >
                      Add Rule
                    </Button>
                  </Box>
                </Paper>
              )}

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Scope</TableCell>
                      <TableCell>Start</TableCell>
                      <TableCell>Success</TableCell>
                      <TableCell>Failure</TableCell>
                      <TableCell>Consecutive</TableCell>
                      <TableCell>Low Storage</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preferences.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="text.secondary" py={2}>
                            No notification rules configured. Click "Add Rule" to create one.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      preferences.map((pref) => (
                        <TableRow key={pref.id}>
                          <TableCell>
                            {pref.backup_profile_id ? (
                              <Chip
                                label={pref.backup_profile?.name || `Profile ${pref.backup_profile_id}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ) : pref.server_id ? (
                              <Chip
                                label={pref.server?.name || `Server ${pref.server_id}`}
                                size="small"
                                color="secondary"
                                variant="outlined"
                              />
                            ) : (
                              <Chip label="Global" size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              size="small"
                              checked={pref.notify_on_start}
                              onChange={(e) => handleUpdatePreference(pref, { notify_on_start: e.target.checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              size="small"
                              checked={pref.notify_on_success}
                              onChange={(e) => handleUpdatePreference(pref, { notify_on_success: e.target.checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              size="small"
                              checked={pref.notify_on_failure}
                              onChange={(e) => handleUpdatePreference(pref, { notify_on_failure: e.target.checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Switch
                                size="small"
                                checked={pref.notify_on_consecutive_failures}
                                onChange={(e) => handleUpdatePreference(pref, { notify_on_consecutive_failures: e.target.checked })}
                              />
                              {pref.notify_on_consecutive_failures && (
                                <Chip label={`≥${pref.consecutive_failure_threshold}`} size="small" />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {!pref.backup_profile_id && !pref.server_id && (
                              <Box display="flex" alignItems="center" gap={1}>
                                <Switch
                                  size="small"
                                  checked={pref.notify_on_low_storage}
                                  onChange={(e) => handleUpdatePreference(pref, { notify_on_low_storage: e.target.checked })}
                                />
                                {pref.notify_on_low_storage && (
                                  <Chip label={`<${pref.low_storage_threshold}%`} size="small" />
                                )}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Delete rule">
                              <IconButton
                                size="small"
                                onClick={() => handleDeletePreference(pref.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notification Types
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="primary">Backup Started</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Notifies when a backup job begins execution.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="success.main">Backup Success</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Notifies when a backup completes successfully.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="error.main">Backup Failed</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Notifies immediately when a backup fails.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="warning.main">Consecutive Failures</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Notifies when a backup profile fails multiple times in a row.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="info.main">Low Storage</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Notifies when storage space falls below the configured threshold.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}

export default NotificationSettings;
