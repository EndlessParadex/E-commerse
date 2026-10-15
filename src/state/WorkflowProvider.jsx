import { Fragment, useEffect, useLayoutEffect } from 'react';
import { useDelivery } from './useDelivery';
import { configureWorkflowSession, refreshServerWorkflow } from './serverWorkflow';
import { workflowUsesServer, catalogRevision, subscribeCatalog } from '../data/adminStore';
import { useSyncExternalStore } from 'react';
export default function WorkflowProvider({ children }) {
  const { user, authLoading } = useDelivery();
  const userId = user?.id;
  const role = user?.role;
  const revision = useSyncExternalStore(subscribeCatalog, catalogRevision, catalogRevision);
  useLayoutEffect(() => {
    if (!workflowUsesServer) return;
    void configureWorkflowSession(userId ? { id: userId, role } : null, authLoading);
    return () => {
      void configureWorkflowSession(null, true);
    };
  }, [userId, role, authLoading]);
  useEffect(() => {
    if (workflowUsesServer && !authLoading) void refreshServerWorkflow();
  }, [revision, authLoading]);
  useEffect(() => {
    if (!workflowUsesServer || authLoading) return;
    const refresh = () => {
      if (!document.hidden) void refreshServerWorkflow();
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [authLoading]);
  return <Fragment key={workflowUsesServer ? user?.id || 'guest' : 'preview'}>{children}</Fragment>;
}
